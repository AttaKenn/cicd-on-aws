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

# sendResponse function
  def sendResponse(event, context, responseStatus, responseData, physicalResourceId=None, noEcho=False):
    responseUrl = event['ResponseURL']
   
    print(responseUrl)
   
    responseBody = {}
    responseBody['Status'] = responseStatus
    responseBody['Reason'] = 'See the details in CloudWatch Log Stream: ' + context.log_stream_name
    responseBody['PhysicalResourceId'] = physicalResourceId or context.log_stream_name
    responseBody['StackId'] = event['StackId']
    responseBody['RequestId'] = event['RequestId']
    responseBody['LogicalResourceId'] = event['LogicalResourceId']
    responseBody['NoEcho'] = noEcho
    responseBody['Data'] = responseData
   
    json_responseBody = json.dumps(responseBody)
   
    print("Response body:" + json_responseBody)
   
    headers = {
        'content-type' : '',
        'content-length' : str(len(json_responseBody))
    }
   
    try:
        response = requests.put(responseUrl,
                                data=json_responseBody,
                                headers=headers)
        print("Status code: " + response.reason)
    except Exception as e:
        print("send(..) failed executing requests.put(..): " + str(e))
