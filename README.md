# CI/CD on AWS

## Overview

This project demonstrates a Continuous Integration and Continuous Delivery (CI/CD) pipeline built on Amazon Web Services (AWS) using CloudFormation. The pipeline automates the build, test, and deployment process for a simple calculator web application.

> **Warning:** Trying this Project in your own AWS account will incur cost. If you are going to attempt this project in your own AWS account, make sure to delete all the stacks when you are done.
The main stack deletion will fail because of non-empty S3 buckets, on the other hand other resources within the stack will be terminated/deleted. Just empty those S3 buckets (CacheBucket & ArtifactBucket) from the S3 console page and delete the stack again.
Next, go to CloudWatch > Logs > Log Groups and delete the Log groups. I've got you covered too if you can't try this project in your own AWS account, just keep reading ;)

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

![CICD Test Stack 1 ASG instances](./MD%20images/Test-stack%20ASG%20instances%20-%20initial%20pipeline%20img-17.png)

The image below shows our Test Stack Auto Scaling Group and the Auto Scaling Policies from the management console.

![Test Stack ASG & ASP](./MD%20images/Test-stack%20ASG%20console%20-%20policies%20shown%20-%20initial%20pipeline%20img-18.png)

The image below displays the Amazon EventBridge Rule *CI-CD-SourceEvent* which starts the CodePipeline release pipeline execution whenever it is triggered by a change *(which is an event)* in the main branch of our CodeCommit Repo. Take note of the *Target Name* and the *Role* which the Rule will assume in order to start the target pipeline.

![CICD SourceEvent with Target tab](./MD%20images/CICD%20SourceEvent%20with%20Target%20img-19.png)

The image below shows our stack's VPC from the VPC console

![CI-CD VPC](./MD%20images/CICD%20VPC%20console%20img-20.png)

Returning to the CodePipeline console, at the Approval Stage and on clicking on the *Review*, there's going to be a pop-up asking if we would like to Approve or Reject the build. ***See image below***.
Take note of the Trigger (user/admin); as mentioned earlier, the pipeline starts during stack creation which I (the admin user) initiated.

![CICD CodePipeline Approval Stage](./MD%20images/CICD%20Codepipeline%20approval%20-%20on%201st%20click%20-%20initial%20pipeline%20img-21.png)

After approving, the pipeline moves to the Delete_Test_Stack stage which will have the Test Stack deleted (This will terminate every resource that was created from the Test Stack including the instances within the Test Stack ASG and the ELB) before moving to the **Prod_Stack** stage to create the Prod[uction] Stack. ***See the image below***.

![CICD CodePipeline After Approval](./MD%20images/CICD%20Codepipeline%20-%20after%20approval%20-%20initial%20pipeline%20img-22.png)

Now when we check the Test Stack ELB URL (Calculator App Webpage) there will be no response because the resources have been purged. ***See image below***.

![Test Stack 1 ELB Url](./MD%20images/test-stack%20elb%20url%20after%20deletion%20-%20initial%20pipeline%20img-23.png)

Moving back to the CloudFormation stacks console page, we will notice that the Test Stack (CICD-test-stack) is nowhere to be found (Delete Completed). The new discovery will be the Prod[uction] Stack (CICD-prod-stack) with the ```CREATE_IN_PROGRESS``` status. We have finally arrived the final stage[s] of our initial pipeline execution. ***See image below***

![CICD Prod Stack from initial pipeline](./MD%20images/CICD%20prod-stack%201%20-%20initial%20pipeline%20img-24.png)

The image below shows the terminated instances from the Test Stack ASG and the newly launched Prod Stack ASG instances in a running state from the EC2 console page.

![CICD EC2 console page - terminated Test Stack 1 instance](./MD%20images/CICD%20EC2%20console%20page%20-%20terminated%20test%20instance%20-%20running%20prod%20instances%20-%20initial%20pipeline%20img-32.png)

After CloudFormation completes the creation of the CICD-prod-stack, we can then get the Url of our Load Balancer in order to visit our application's page running in the production environment. ***See image below***.

![CICD Prod Stack Outputs from initial pipeline](./MD%20images/CICD%20prod-stack%201%20outputs%20-%20initial%20pipeline%20img-25.png)

On visiting the page, the Load Balancer returns a *"502 Bad Gateway"* response. This happened because whiles CloudFormation is done creating the stack, AWS CodeDeploy is yet to Deploy the application to the ASG EC2 instances. The pipeline is yet to be complete. ***See image below***.

![CICD Prod Stack ELB Url before CodeDeploy Actions complete](./MD%20images/CICD%20prod-stack%201%20elb%20url%20before%20codedeploy%20deployment%20img-26.png)

Going back to the CodePipeline console, we can notice that the pipeline execution has completed; CodeDeploy application deployment succeeded. ***See image below***.

![CICD Prod_Stack Stage completion from initial pipeline execution](./MD%20images/CICD%20prod-stack%201%20-%20initial%20pipeline%20complete%20-%20from%20CPP%20console%20img-27.png)

Now returning back to the webpage and refreshing, we see our website live and running in our production environment (stack). ***See image below***.

![CICD Prod Stack ELB Url from initial pipeline](./MD%20images/CICD%20prod-stack%201%20-%20elb%20url%20img-28.png)

### Next Step: Updating the Remote CodeCommit Repository

Next I will be pushing some code changes to our remote CodeCommit Repository from my local machine to trigger a new pipeline execution. Follow the steps below to connect your local repository to your remote CodeCommit repository:

1. In your AWS Account go to IAM.

2. Go to **Users** and select the IAM User for which you would like to generate an AWS CodeCommit credentials.

3. At the selected IAM User page, look for the **Security credentials**  tab and click on it.

4. Scroll down to **HTTPS Git Credentials for AWS CodeCommit** and click on **Generate credentials**.

5. Download the credentials file and keep it in a secure location.

You can then clone the repository by using the provided Url from the CodeCommit console page.

```git remote add origin [URL]```

```git remote -v```

```git clone [URL]```

Use the downloaded credentials to authenticate when you try to connect to the remote CodeCommit Repository.

 ***See the image below.***

![CICD Local Git Repo](./MD%20images/CICD%20Local%20Git%20Repo%20-%20initial%20pipeline%20img-29.png)

Next, we make some changes to the index.html file. We simply add "Version 2" to the h1 tag making it **"Simple Calculator Service Version 2"**. ***See image below***.

![Index.html first change](./MD%20images/index.html%20first%20change%20-%20version%202%20img-30.png)

Next, the new code change is committed and pushed to the remote CodeCommit Repo to start a new pipeline execution. ***See the 2 images below***.

![CICD CodePipeline Console - First trigger](./MD%20images/CICD%20Codepipeline%20console%20-%201st%20trigger%20img-31.png)

![CICD CodePipeline Console - Static Check in progress - First trigger](./MD%20images/CICD%20Codepipeline%20console%20-%20static-check%20in%20progress%20-%201st%20trigger%20img-33.png)

As the pipeline continues through to the Test_Stack stage and going back to the CloudFormation console page, we will see a new test stack (CICD-test-stack) in a ```REVIEW_IN_PROGRESS``` state. ***See image below***.

![CICD New Test Stack (2) from 1st Pipeline trigger](./MD%20images/CICD%20prod-stack%20from%20init%20pipe%20online%20with%20new%20test-stack%20for%201st%20pipeline%20trigger%20creating%20img-34.png)

After the new test stack achieves a ```CREATE_COMPLETE``` status, we then go to the **Outputs** tab to get the Url provided by our load balancer in order to visit the newly updated webpage. ***See image below***.

![CICD Test Stack 2 Outputs from 1st Pipeline trigger](./MD%20images/CICD%20test-stack%202%20completed%20with%20outputs%20inclu.%20elb%20url%20img-35.png)

The image below shows the newly updated page on our Test Stack ASG instances. I have highlighted the "Version 2" from the webpage.

![CICD Test Stack 2 ELB URL to Webpage](./MD%20images/CICD%20test-stack%202%20elb%20url%20with%20updated%20page%20-%20version%202%20img-36.png)

Going back to the EC2 Console page, we can see 6 instances running, 3 from the new Test Stack and 3 from the Prod Stack which was created in the initial pipeline execution. In addition to the 6 running instances, we have the 3 terminated instances from the First Test Stack which was created in the initial pipeline. ***See image below, as always ;)***

> Note that instances from the Test Stack have the name *simple-calculator-***Test**** and instances from the Prod Stack have the name *simple-calculator-***Prod****.

![CICD EC2 console page with 6 running instances](./MD%20images/CICD%20EC2%20console%20page%20-%206%20running%20instances%20img-37.png)

Going back to the release pipeline from the CodePipeline console page, at the Approval stage we click on *Review*. From the **Details** section, under the Trigger we can see that ***CloudWatchEvent - rule/CI-CD-SourceEvent*** triggered the pipeline execution. Compare with [CICD CodePipeline Approval Stage](./MD%20images/CICD%20Codepipeline%20approval%20-%20on%201st%20click%20-%20initial%20pipeline%20img-21.png) and ***See image below***.

![CICD CodePipeline - Approval for Version 2](./MD%20images/CICD%20Codepipeline%20%20-%20approval%20-%20approving%20for%20version%202%20img-38.png)

Clicking on the **Revisions** tab will provide some details on the Revision along with links to the CodeCommit Repo showcasing where the changes happened within the code. The image below shows the code change in the CodeCommit Repo.

![Revision check - First Trigger](./MD%20images/Revision%20check%20for%20code%20push%20from%20approval%20stage%20-%201st%20trigger%20img-39.png)

After Approving the new Build (code push), the pipeline moves to the Delete_Test_Stack stage prompting CloudFormation to purge (delete) the **CICD-Test-Stack** before moving on to the Prod_Stack stage. ***See image below***.

![Purging Test Stack 2 after Approval](./MD%20images/CICD%20on%20approving%20test-stack%20for%201st%20target%20pipe%20is%20purged%20img-40.png)

The image below from EC2 Console shows the Test Stack ASG instances in the *shutting down* state, preparing to be terminated.

![Test Stack 2 ASG instances Shutting Down](./MD%20images/test-stack%202%20ASG%20instances%20starts%20shutting%20down%20after%201st%20trigger%20approval%20img-41.png)

Once the Pipeline execution is complete, we can visit the production webpage, refresh the browser to see the newly updated application. ***See image below*** and compare with [CICD Prod Stack ELB Url from initial pipeline](./MD%20images/CICD%20prod-stack%201%20-%20elb%20url%20img-28.png). 

> Note: There has been no change with the production infrastructure. Only the application was updated. Production URL remains the same.

![CICD Prod Stack ELB URL after version 2 update](./MD%20images/CICD%20prod-stack%201%20-%20elb%20url%20after%20page%20update%20to%20version%202%20img-42.png)

### Next Step: Introducing code error to cause Pipeline Execution Failure

To introduce an error, I changed the value of the variable PORT in the [service.js](./calculator/service.js) from 8080 to 80, and pushed the committed code to the remote repository. ***See image below***.

![Error code in service.js](./MD%20images/service-js%20broken%20code%20-%20changed%20port%20number%20from%208080%20to%2080%20img-43.png)

The new Pipeline execution runs through to the Test_Stack stage where it fails at the Deploy sub-stage handled by AWS CodeDeploy. ***See image below***.

> Note: Changeset for the Test Stack was executed, successfully creating resources like the ASG instances and the ELB. You can optionally delete the test stack since the CodeDeploy deployment failed before you trigger the pipeline to start again. When you delete the CICD-test-stack, the pipeline will re-create it when it starts again. You can also leave it there, on starting the pipeline again, when it reaches the Test_Stack stage, it will quickly jump to the Deploy sub-stage. In this instance, I chose to delete the CICD-test-stack after the failed deployment.

![CICD CodePipeline Console - Failed Application Deployment](./MD%20images/CICD%20Codepipeline%20console%20test-stack-codedeploy%20failed%20stage%20img-44.png)

Clicking on the **View details** will display the *Action execution details*. ***See image below***.

![CICD CodePipeline Console - CodeDeploy details](./MD%20images/CICD%20Codepipeline%20console%20test-stack-codeploy%20failed%20stage%20exe%20details%20img-45.png)

Under the *Execution details* in the pop-up, there is a *View in CodeDeploy* link, clicking on it will send us to CodeDeploy's console page where we can learn more about the error/failure. ***See image below***.

![CICD CodeDeploy Concole](./MD%20images/CICD%20CodeDeploy%20applications%20console%20-%20deployments%20groups%20tab%20img-46.png)

Next we click on the *CICD-test-stack-DeploymentGroup* for more details about the deployment events. From the page, we can see that the Lifecycle event hook (ValidateService) failed. Check [appspec.yml](./calculator/appspec.yml) & [validate.sh](./calculator/deploy_scripts/validate.sh). ***See image below***.

![CICD CodeDeploy Deployment Events](./MD%20images/CICD%20CodeDeploy%20deployment%20events%20-%20script%20failed%20img-47.png)

Let's click on the *ScriptFailed* link in the *Error code* column to view the Event Logs. ***See image below***.

![CICD CodeDeploy Failed Event Logs](./MD%20images/CICD%20CodeDeploy%20deployment%20events%20-%20script%20failed%20-%20detail%20page%20with%20logs%20img-48.png)

We can see from the image above that there is no running application server listening on port 8080 on the EC2 instance due to the error in the [service.js](./calculator/service.js).

Remember also that our Application Load Balancer is configured to forward traffic to our backend service (ASG instances) on port 8080. ***See the following 2 images below***.

![CICD-test-stack 3 Outputs from CloudFormation Console](./MD%20images/CICD%20test-stack%203%20outputs%202nd%20pipeline%20trigger%20img-49.png)

![CICD-test-stack 3 URL](./MD%20images/CICD%20elb%20url%20for%20test-stack%203%20when%20codedeploy%20deployment%20failed%20img-50.png)

Next, the CICD-test-stack is manually deleted from the CloudFormation console, the value of the PORT variable in the [service.js](./calculator/service.js) is corrected (changed back to 8080 from 80), and the [index.html](./calculator/public/index.html) is updated to "...Version 3". ***See image below***.

![index.html second change - version 3](./MD%20images/index.html%20second%20change%20-%20version%203%20-%20port%20number%20corrected%20img-51.png)

The change is committed and then pushed to the remote CodeCommit repository to start a new pipeline execution. ***See the image below*** which shows the CICD release pipeline's executions including the just started one with the ***"In progress"*** status. Check the Triggers.

![CICD CodePipeline history](./MD%20images/CICD%20Codepipeline%20-%203rd%20trigger%20-%20mini%20history%20img-52.png)

The image below shows the from the console the build history for the CICD CodeBuild Project.

![CICD CodeBuild History from console](./MD%20images/CICD%20CodeBuild%20build%20history%20after%203rd%20trigger%20-%20codebuild%20console%20img-53.png)

The image below shows the updated calculator application webpage from the test stack, soon to be deployed to the prod stack in the pipeline.

![CICD Test Stack 4 ELB URL](./MD%20images/CICD%20test-stack%204%20elb%20url%20after%203rd%20trigger%20-%20ver%203%20img-54.png)

The image below shows the commit history of the AWS CodeCommit repository.

![Repository commit history](./MD%20images/CICD%20CodeCommit%20Repo%20commit%20history%20-%20console%20-%20after%203rd%20trigger%20img-55.png)

The image below shows Prod_Stack stage from the CodePipeline console after approving the push update (build). CodeDeploy prepares to deploy the update into the CICD-prod-stack ASG intances.

![CICD CodePipeline Prod_Stage in progress](./MD%20images/CICD%20codepipeline%20prod-stack%20stage%20after%203rd%20trigger%20and%20approval%20img-56.png)

The image below shows the CodeDeploy deployment history. Take note of the **Initiating event** field where all are *User actions*.

> Note: Under the deployment group field/column, there are no test-stack related deployments because all CICD-test-stack-DeploymentGroups resources are deleted on deleting the CICD-test-stack stacks.

![CICD CodeDeploy deployment history](./MD%20images/CICD%20CodeDeploy%20deployment%20history%20after%203rd%20trigger%20and%20approval%20img-57.png)

The image below shows the updated webpage in the prod stack. The pipeline execution has completed.

![CICD Prod Stack calculator application webpage](./MD%20images/CICD%20prod-stack%201%20-%20elb%20url%20after%20page%20update%20to%20version%203%20img-58.png)

### Next: Terminating the Prod Stack EC2 instances

Everything is working perfectly now, Let's see what happens if the Prod[uction] Stack ASG EC2 instances are terminated from the EC2 console. ***See image below***.

![Terminating Prod Stack ASG instances](./MD%20images/CICD%20EC2%20console%20page%20-%20terminate%20prod-stack%20instances%20img-59.png)

The image below shows the response after terminating all the instances hosting the calculator application.

> Note: This response is from the Application ELB. It forwards the traffic to the ASG, and now there are no instances in the ASG to handle the requests.

![Page Response after terminating Prod Stack ASG instances](./MD%20images/CICD%20prod-stack%201%20-%20elb%20url%20after%20terminating%20prod-stack%20instances%20img-60.png)