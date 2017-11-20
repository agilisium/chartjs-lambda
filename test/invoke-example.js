// Copyright 2017 Agilisium, or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may not
// Use this file except in compliance with the License. A copy of the License is
// located in the "LICENSE" file accompanying this file. This file is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.

//
// Sample NodeJS test application showing how to build up the required parameters and invoke the Lambda function
//

let AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});
let lambda = new AWS.Lambda({region: 'us-west-2'});

// Construct a ChartJS request object.
// Mandatory to provide an embedded JSON object "chartJsOptions".

let myRequest = {

    chartJsOptions: {                           // "chartJsOptions" required
        type: "line",                           // Others include bar, pie ...
        data: {

            labels: ["A", "B", "C", "D", "E"],
            datasets: [{
                label: "Product Demand",
                data: [12, 18, 16, 23, 18],    // Data from your service
                backgroundColor: "tomato",     // RGB values or CSS mnemonic
                pointRadius: 0
            }]
        },
        options: {}
    },
    s3Prefix: "mycharts/image-",
    chartWidth: 480,
    chartHeight: 320,
    expireTime: 604800,
    fileFormat: "jpg"
};

let payload = JSON.stringify(myRequest);

let params = {
    FunctionName: "<CHANGEME>",                // Your function name here.  From CloudFormation SAM launch.
    InvocationType: "RequestResponse",
    LogType: "Tail",
    Payload: payload,
};

lambda.invoke(params, function (err, data) {   // Call it!
    if (err) console.log(err, err.stack);
    else console.log(data);
});
