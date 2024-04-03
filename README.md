# CI/CD on AWS

## Overview

This project demonstrates a Continuous Integration and Continuous Delivery (CI/CD) pipeline built on Amazon Web Services (AWS) using CloudFormation. The pipeline automates the build, test, and deployment process for a simple calculator web application.

> **Warning:** Trying this Project in your own AWS account will incur cost. If you are going to attempt this project in your own AWS account, make sure to delete all the stacks when you are done.
The main stack deletion will fail because of non-empty S3 buckets, on the other hand other resources within the stack will be terminated/deleted. Just empty those S3 buckets (CacheBucket & ArtifactBucket) from the S3 console page and delete the stack again.
Next, go to CloudWatch > Logstream Groups and delete the logstreams

The project includes two CloudFormation templates:

- [cicd.yaml](cicd.yaml) (main template): Located in the root directory, this template defines the core infrastructure for the CI/CD pipeline. It includes resources like CodeBuild project, CodePipeline for automating the release pipeline, and supporting services (totaling 40 resources). You can view the complete list of resources within the **Resources** section of the template. Additionally, some resources like the VPC and subnets are configured for sharing and can be reused by the second stack.

- [application.json](./calculator/cloudformation/application.json) (Application template): This template defines the infrastructure for the calculator application itself. It includes resources like Auto Scaling Groups (ASG) to deploy and manage instances that will host the application. Similar to the main template, you can view all the resources within the **Resources** section of the template.

### CI/CD Pipeline

#### Source

The AWS CodePipeline Release pipeline starts on creating the CloudFormation stack. The source is a CodeCommit Repository which contains the [calculator](./calculator/) directory.

#### Static Code Analysis

The next stage involves a Lambda function [Lambda function](./functions/cfn_validate_lambda.py) that performs static code analysis on the second CloudFormation template. It ensures the template doesn't include security groups allowing:

- Ingress traffic from anywhere (0.0.0.0/0)
- SSH access from anywhere on port 22

#### Build

The following stage is the **build** stage, utilizing AWS *CodeBuild* to run tests and build the application for deployment.

#### Test_Stack_Stage

The subsequent stage, "Test_Stack_Stage," encapsulates three sub-stages:

1. AWS CloudFormation: test-stack-changeset [CHANGE_SET_REPLACE]: This stage leverages the second CloudFormation Template *([application.json](./calculator/cloudformation/application.json))* to generate a changeset for the main stack *([cicd.yaml](cicd.yaml))*.

2. AWS CloudFormation: test-stack-changeset [CHANGE_SET_EXECUTE]: The generated changeset is executed, creating a new stack with a name containing "-test-stack". The resources created in this stack (including an Application Elastic Load Balancer for the Auto Scaling Groups) can be found in the **Resources** section of the *[application.json](./calculator/cloudformation/application.json)* template.

3. AWS CodeDeploy: CICD-test-stack-DeploymentGroup: The CodeDeploy agent, automatically installed on ASG instances (see **LaunchConfig** from the **Resources** section in [cicd.yaml](cicd.yaml) and **AutoScalingGroup** from the **Resources** section in [application.json](./calculator/cloudformation/application.json)), deploys the simple calculator web application to each instances within the ASG as part of Deployment Group.

#### Application Health Check (Service Status)

The next stage in the pipeline is a Lambda Function that verifies the application's health and responsiveness to user requests. Here's how it works:

- **Retrieve Load Balancer URL**: The Lambda function accesses the Application Load Balancer's URL, an output from the test-stack deployment.

- **Send GET Request**: The function sends a GET request to the retrieved URL.

- **Validate Response**: It scrutinizes the response text for the string "simple calculator service"

- **Signal CodePipeline**: If the validation succeeds, signaling CodePipeline that the stage has passed. Otherwise, it fails the stage, indicating a potential issue with the application's deployment or functionality.

#### Manual Approval Stage

This stage introduces a human review step before deploying the application to production. A reviewer can assess the code changes that triggered the pipeline before authorizing the deployment.

##### Approval Process

If the reviewer approves the changes, the pipeline proceeds to:

- **Purge Test Stack:** CloudFormation deletes the temporary test stack (-test-stack) created during the testing phase.

- **Create Production Stack:** A new CloudFormation stack having "prod-stack" in its name is created, containing the production infrastructure for the calculator application. If the prod-stack already exist, CodeDeploy will deploy the new software update unto the running instances.

If the reviewer rejects the changes, the pipeline fails, preventing unintended deployments.

#### Prod_Stack_Stage (Production Deployment Stage)

This stage orchestrates the deployment of the application to production. It also utilizes three sub-stages:

1. AWS CloudFormation: prod-stack-changeset [CHANGE_SET_REPLACE]: Similar to the testing stage, this sub-stage leverages the second CloudFormation template *([application.json](./calculator/cloudformation/application.json))* to generate a changeset for the main stack *([cicd.yaml](cicd.yaml))*.

2. AWS CloudFormation: prod-stack-changeset [CHANGE_SET_EXECUTE]: The generated changeset is executed, creating a new stack with a name containing "-prod-stack". The resources created in this stack (including an Application Elastic Load Balancer for the Auto Scaling Groups) can be found in the **Resources** section of the *[application.json](./calculator/cloudformation/application.json)* template.

3. AWS CodeDeploy: CICD-prod-stack-DeploymentGroup: The CodeDeploy agent, automatically installed on ASG instances (see **LaunchConfig** from the **Resources** section in [cicd.yaml](cicd.yaml) and **AutoScalingGroup** from the **Resources** section in [application.json](./calculator/cloudformation/application.json)), deploys the simple calculator web application to each instances within the ASG as part of Deployment Group.

> Note: If prod-stack already exist, no changes will be made to the resources, the pipeline will quickly jump to the CodeDeploy stage which will deploy the new software update on the instances.

Below is an image depicting the architecture of the Release Pipeline:

<figure>
    <img src="./MD images/CICD CodePipeline Pipeline.png" width="250">
    <figcaption>CodePipeline Release Pipeline</figcaption>
</figure>
