const assert = require('assert');
const AWS = require('aws-sdk');
const http = require('http');

exports.handler = (event, context) => {
    var codepipeline = new AWS.CodePipeline();

    // Retrieve the Job ID from the Lambda action
    var jobId = event["CodePipeline.job"].id;

    // Retrieve the value of UserParameters from the Lambda action configuration in AWS CodePipeline,
    // in this case a URL which will be health checked by this function.
    var url = event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters;

    // Notify AWS CodePipeline of a successful job
    const putJobSuccess = (message) => {
        var params = {
            jobId: jobId
        };
        codepipeline.putJobSuccessResult(params, (err, data) => {
            if(err) {
                context.fail(err);
            } else {
                context.succeed(message);
            }
        });
    };

    // Notify AWS CodePipeline of a failed job
    const putJobFailure = (message) => {
        var params = {
            jobId: jobId,
            failureDetails: {
                message: JSON.stringify(message),
                type: 'JobFailed',
                externalExecutionId: context.invokeid
            }
        };
        codepipeline.putJobFailureResult(params, (err, data) => {
            context.fail(message);
        });
    };

    // Validate the URL passed in UserParameters
    if(!url || url.indexOf('http://') === -1) {
        putJobFailure('The UserParameters field must contain a valid URL address to test, including http:// or https://');
        return;
    }

    // Helper function to make an HTTP GET request to the page.
    // The helper will test the response, and succeed or fail the job accordingly
    const getPage = (url, callback) => {
        var pageObject = {
            body: '',
            statusCode: 0,
            contains: function(search) {
                return this.body.indexOf(search) > -1;
            }
        };
        http.get(url, (response) => {
            pageObject.body = '';
            pageObject.statusCode = response.statusCode;

            response.on('data', (chunk) => {
                pageObject.body += chunk;
            });

            response.on('end', () => {
                callback(pageObject);
            });

            response.resume();
        }).on('error', (error) => {
            // Fail the job if the request failed
            putJobFailure(error);
        });
    };

    getPage(url, (returnedPage) => {
        try {
            // Checks if the HTTP response has a 200 status
            console.log("checking for status code 200");
            assert(returnedPage.statusCode === 200);
            
            // Checks if returned page contains 'Simple Calculator Service'
            console.log("Confirming that the page contains 'Simple Calculator Service'");
            assert(returnedPage.contains('Simple Calculator Service'));

            // Succeed the job
            console.log("Tests passed.");
            putJobSuccess("Tests passed.");
        } catch (exception) {
            // If any of the assertions fail, the job is failed
            console.log(exception);
            putJobFailure(exception);
        }
    });
};