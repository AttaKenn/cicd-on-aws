# CI/CD on AWS

## Overview

In this project, I create a Continuous Integration and Continuous Delivery (CI/CD) Infrastructure for a simple calculator web application as an Amazon Web Service (AWS) CloudFormation Stack.

In this GitHub repository, there are two CloudFormation templates, the main template ([cicd.yaml](cicd.yaml)) found in the root directory contains the instructions for creating the resources for the CI/CD pipeline along with other supporting **shared** resources including but not limited to:

- IAM Resources such as roles and policies.

- VPC

- Lambda Functions

- DynamoDB Table

The second template [application.json](./calculator/cloudformation/application.json) contains the instructions for creating the resources to host the simple calculator applicatioin.  