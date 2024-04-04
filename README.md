# CI/CD on AWS

## Overview

This project demonstrates a Continuous Integration and Continuous Delivery (CI/CD) pipeline built on Amazon Web Services (AWS) using CloudFormation. The pipeline automates the build, test, and deployment process for a simple calculator web application.

> **Warning:** Trying this Project in your own AWS account will incur cost. If you are going to attempt this project in your own AWS account, make sure to delete all the stacks when you are done.
The main stack deletion will fail because of non-empty S3 buckets, on the other hand other resources within the stack will be terminated/deleted. Just empty those S3 buckets (CacheBucket & ArtifactBucket) from the S3 console page and delete the stack again.
Next, go to CloudWatch > Logstream Groups and delete the logstreams. I've got you covered too if you can't try this project in your own AWS account, just keep reading ;)

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
    <img src="./MD images/CICD CodePipeline Pipeline.png" width="250" alt="CodePipeline Release Pipeline">
    <figcaption>CodePipeline Release Pipeline</figcaption>
</figure>

## Deep Dive into the Project

### CloudShell

I started from my AWS CloudShell where I uploaded these files into my CloudShell instance:

- [calculator.zip](./calculator.zip)

- [functions.zip](./functions.zip)

- [cicd.yaml](./cicd.yaml)

> Note: To upload your files into your CloudShell instance, click on the "Actions" button at the top right corner of the CloudShell console and select upload file.

#### Creating an S3 Bucket from the CloudShell

I then created an S3 Bucket and copied the zip files into it, here are the commands:

- ```aws s3 mb s3://attakenn-cicd-codebucket```

- ```aws s3 sync . s3://attakenn-cicd-codebucket --exclude "cicd.yaml"```

The last command will sync the current working directory with the S3 bucket by copying the zip files into the S3 bucket excluding the cicd.yaml file.

#### Creating the CloudFormation Stack from the CloudShell

```aws cloudformation create-stack --stack-name CICD --template-body file://cicd.yaml --parameters ParameterKey=codeBucket,ParameterValue=attakenn-cicd-codebucket --capabilities CAPABILITY_NAMED_IAM --disable-rollback --region us-west-2```

The [cicd.yaml](./cicd.yaml) CloudFormation template requires an S3 bucket name as an input value for the codeBucket parameter.

CAPABILITY_NAMED_IAM is added because CloudFormation will be creating some custom named IAM Resources such as IAM Roles.

See the image below (check response from CloudFormation):

![CloudShell](./MD%20images/CloudShell.png)

The image below shows the CloudFormation console on creating the CICD stack.

![CloudFormation console page - main stack creating](./MD%20images/CloudFormation%20console%20page%20-%20img-3.png)

The image below shows the Artifacts and Cache buckets that have been created from the CloudFormation Template including the codebucket.

![S3 Console](./MD%20images/S3%20buckets%20img-4.png)

The image below is from the DynamoDB console displaying the DBRules table and the Rules items that has been inserted by the [CFNValidate](./functions/cfn_validate_lambda.py) Lambda Function.

![DynamoDB Rules Table](./MD%20images/CICD%20Dynamo%20DB%20console%20img-12.png)

The image below is from the CodeCommit Repository console page that was created as part of the stack.

![CodeCommit Repo](./MD%20images/CICD%20CodeCommit%20Repo%20console%20page%20img-5.png)

The image below shows from the console when the main stack's (CICD) creation is complete, you will also see the test stack (CICD-test-stack) in a ```CREATE_IN_PROGRESS```; this means everything is going on well with our Pipeline and it had reached that stage. We will get to the pipeline soon.

![CloudFormation console - main and test stack](./MD%20images/CICD%20test-stack%201%20create%20in%20progress%20-%20cfn%20console%20img-6.png)

Full console image here showing the COMPLETE SUCCESS message of some of the resources within the main stack.

![CloudFormation console - main and test stack fullpage](./MD%20images/CICD%20test-stack%201%20create%20in%20progress%20-%20cfn%20console%20fullpage%20img-7.png)

The image below shows the outputs from the main stack (CICD). The outputs will be exported to be used by other stacks such as the test and prod stacks (check the 'Export name' field)

![CloudFormation console - CICD stack outputs](./MD%20images/CICD%20main%20stack%20outputs%20img-8.png)

The image below shows the stack parameters (Keys and corresponding Values), notice the resolved value for the **LatestAmiId** parameter.

![CICD Stack Parameters](./MD%20images/CICD%20main%20stack%20parameters%20img-9.png)

The image below is from the stack's release pipeline console page, it displays the source and Static_Check stages.

![CICD CodePipeline console - initial pipeline](./MD%20images/CICD%20CodePipeline%20console%20-%20initial%20pipeline%20img-10.png)

The image below displays the Build and Test_Stack stages.

![CICD CodePipeline console - Build and Test_Stack Stages](./MD%20images/CICD%20Codepipeline%20console%20-%20test-stack-stage%20-%20initial%20pipeline%20img-11.png)

The image below displays the Service_Status stage and the *Pending* Approval stage of the pipeline.

![CICD CodePipeline console - Service_Status and Approval Stages](./MD%20images/CICD%20Codepipeline%20console%20-%20passed%20service%20status%20-%20approval%20stage%20-%20initial%20pipeline%20img-13.png)

The image below shows the logs from the Service_Status Lambda Function from the CloudWatch Logs. The logs displays that the test passed and the web application is running fine.

![CICD Service Status CloudWatch Logs](./MD%20images/CICD%20service%20status%20cloudwatch%20logs%20-%20initial%20pipeline%20img-14.png)

When the Test Stack status changes to ```CREATE_COMPLETE``` we can go to the **Outputs** tab to get the ELB Url in order to access our web application. See the image below.

![CICD Test Stack 1 Outputs](./MD%20images/CICD%20test-stack%201%20complete%20-%20outputs%20with%20elb%20url%20%20img-15.png)

The image below shows the calculator web application page.

![Calculator Webpage - initial pipeline](./MD%20images/Test-stack%20ELB%20url%20-%20initial%20pipeline%20img-16.png)

The image below shows our Test Stack Auto Scaling Group (ASG) instances from the EC2 console page hosting our calculator application.

![CICD Test Stack 1 ASG instances](./MD%20images/Test-stack%20ASG%20instances%20-%20initial%20pipeline%20img%2017.png)

The image below shows our Test Stack Auto Scaling Group and the Auto Scaling Policies from the management console.

![Test Stack ASG & ASP](./MD%20images/Test-stack%20ASG%20console%20-%20policies%20shown%20-%20initial%20pipeline%20img-18.png)

The image below displays the Amazon EventBridge Rule *CI-CD-SourceEvent* which starts the CodePipeline release pipeline execution whenever it is triggered by a change *(which is an event)* in the main branch of our CodeCommit Repo. Take note of the *Target Name* and the *Role* which the Rule will assume in order to start the target pipeline.

![CICD SourceEvent with Target tab](./MD%20images/CICD%20SourceEvent%20with%20Target%20img-19.png)

The image below shows our stack's VPC from the VPC console

![CI-CD VPC](./MD%20images/CICD%20VPC%20console%20img-20.png)

Returning to the CodePipeline console, at the Approval Stage and on clicking on the *Review*, there's going to be a pop-up which asking if we would like to Approve or Reject the build. ***See image below***.
Take not of the Trigger (user/admin); as mentioned earlier, the pipeline starts during stack creation which I (the admin user) initiated.

![CICD CodePipeline Approval Stage](./MD%20images/CICD%20Codepipeline%20approval%20-%20on%201st%20click%20-%20initial%20pipeline%20img-21.png)

After approving, the pipeline moves to the Delete_Test_Stack stage which will have the Test Stack deleted (This will terminate every resource that was created from the Test Stack including the instances within the Test Stack ASG and the ELB) before moving to the **Prod_Stack** stage to create the Prod[uction] Stack. ***See the image below***.

![CICD CodePipeline After Approval](./MD%20images/CICD%20Codepipeline%20-%20after%20approval%20-%20initial%20pipeline%20img-22.png)

Now when we check the Test Stack ELB URL (Calculator App Webpage) there will be no response because the resources have been purged. ***See image below***.

![Test Stack 1 ELB Url](./MD%20images/test-stack%20elb%20url%20after%20deletion%20-%20initial%20pipeline%20img-23.png)

Moving back to the CloudFormation stacks console page, we will notice that the Test Stack (CICD-test-stack) is nowhere to be found (Delete Completed). The new discovery will be the Prod[uction] Stack (CICD-prod-stack) with the ```CREATE_IN_PROGRESS``` status. We have finally arrived the final stage[s] of our initial pipeline execution. ***See image below***

![CICD Prod Stack from initial pipeline](./MD%20images/CICD%20prod-stack%201%20-%20initial%20pipeline%20img-24.png)