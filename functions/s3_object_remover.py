import boto3, json
from botocore.vendored import requests
        
def lambda_handler(event, context):
  # Empty Cache and Artifact buckets
  try:
    print(event)
    bucket_name = event['ResourceProperties']['s3bucket']
    if event["RequestType"] == 'Delete':
      resource = boto3.resource('s3')
      bucket = resource.Bucket(bucket_name)
      bucket.objects.all().delete()
      bucket.object_versions.delete()
      msg = "Deleted objects in bucket: " + bucket_name
      responseData = {}
      responseData['Data'] = msg
      sendResponse(event, context, "SUCCESS", responseData, event["LogicalResourceId"])
    else:
      msg = "No work to do"
      responseData = {}
      responseData['Data'] = msg
      sendResponse(event, context, "SUCCESS", responseData, event["LogicalResourceId"])
  except Exception as e:
    msg = f"Exception raised for function: Exception details: {e}"
    responseData = {}
    responseData['Data'] = msg
    sendResponse(event, context, "FAILED", responseData, event["LogicalResourceId"])
