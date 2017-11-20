// Copyright 2017 Agilisium, or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may not
// Use this file except in compliance with the License. A copy of the License is
// located in the "LICENSE" file accompanying this file. This file is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.
//

'use strict';

exports.getChart = function (event, context, callback) {

    const ChartjsNode = require("chartjs-node");
    const AWS = require("aws-sdk");
    const ShortID = require("shortid");
    const S3 = new AWS.S3();

    const ENV_VAR_S3_BUCKET = "S3_BUCKET";            // REQUIRED
    const EVENT_KEY_S3_PREFIX = "s3Prefix";           // Optional
    const EVENT_KEY_CHART_BODY = "chartJsOptions";    // REQUIRED
    const EVENT_KEY_WIDTH = "chartWidth";             // Optional
    const EVENT_KEY_HEIGHT = "chartHeight";           // Optional
    const EVENT_KEY_EXPIRE_TIME = "expireTime"        // Optional
    const EVENT_KEY_FORMAT = "fileFormat"             // Optional

    const DEFAULT_S3_PREFIX = "";
    const DEFAULT_WIDTH = 480;
    const DEFAULT_HEIGHT = 320;
    const DEFAULT_EXPIRE_TIME = 300;
    const MAX_EXPIRE_TIME = 604800;
    const DEFAULT_CONTENT_TYPE = "image/png";
    const DEFAULT_FILE_EXTENSION = ".png";

    const BACKGROUND_FILL_OPTION = {

        beforeDraw: function (chartInstance) {
            let ctx = chartInstance.chart.ctx;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
        }
    };

    // let chartJsOptions = {
    //     "type": "line",
    //     "data": {
    //         "labels": ["A", "B", "C", "D", "E"],
    //         "datasets": [{
    //             "label": "Product Demand",
    //             "data": [12, 18, 16, 23, 18],
    //             "backgroundColor": "tomato",
    //             "pointRadius": 0
    //         }]
    //     },
    //     "options": {}
    // };


    let s3Bucket = "";
    let s3Key = "";
    let chartJsOptions = {};
    let s3prefix = DEFAULT_S3_PREFIX;
    let chartWidth = DEFAULT_WIDTH;
    let chartHeight = DEFAULT_HEIGHT;
    let expireTime = DEFAULT_EXPIRE_TIME;
    let contentType = DEFAULT_CONTENT_TYPE;
    let fileExtension = DEFAULT_FILE_EXTENSION;


    // Check for required parameters
    // S3 passed as environment variable to ensure proper configuration (ACLs, CORS) through surrounding
    // CloudFormation framework or equivalent
    //
    if (!process.env[ENV_VAR_S3_BUCKET]) {
        return callback(new Error("[InternalServerError] Missing required environment variable '" + ENV_VAR_S3_BUCKET + "'"));
    }
    s3Bucket = process.env[ENV_VAR_S3_BUCKET];

    if (!event.hasOwnProperty(EVENT_KEY_CHART_BODY)) {
        return callback(new Error("[BadRequest] Validation error: Missing field '" + EVENT_KEY_CHART_BODY + "'"));
    }

    // Now attempt to process the ChartJS JSON payload
    // Refer to http://www.chartjs.org/ and https://github.com/vmpowerio/chartjs-node for payload syntax
    //
    //
    try {

        let rawInputOptions = event[EVENT_KEY_CHART_BODY];

        // Preprocess if testing from AWS Lambda Console
        if (typeof(rawInputOptions) === "string") {
            let tempVersion = rawInputOptions.replace(/'/g, '"');
            chartJsOptions = JSON.parse(tempVersion);
        }
        else {
            chartJsOptions = rawInputOptions;
        }

        console.log(chartJsOptions);

        chartJsOptions['options']['plugins'] = BACKGROUND_FILL_OPTION;
    }
    catch (e) {
        return callback(new Error("[BadRequest] Validation error: Unable to parse JSON payload for '" + EVENT_KEY_CHART_BODY + "'"));
    }

    // Grab optional parameters if supplied
    if (event.hasOwnProperty(EVENT_KEY_S3_PREFIX)) {
        s3prefix = event[EVENT_KEY_S3_PREFIX];
    }
    if (event.hasOwnProperty(EVENT_KEY_WIDTH)) {
        chartWidth = event[EVENT_KEY_WIDTH];
    }
    if (event.hasOwnProperty(EVENT_KEY_HEIGHT)) {
        chartHeight = event[EVENT_KEY_HEIGHT];
    }
    if (event.hasOwnProperty(EVENT_KEY_EXPIRE_TIME)) {
        expireTime = event[EVENT_KEY_EXPIRE_TIME];
        if (expireTime > MAX_EXPIRE_TIME) {
            return callback(new Error("[BadRequest] Validation error: Exceed max S3 Expire Time (seconds) of " + MAX_EXPIRE_TIME));
        }
    }
    if (event.hasOwnProperty(EVENT_KEY_FORMAT)) {
        if (event[EVENT_KEY_FORMAT] === "jpg") {
            contentType = "image/jpeg";
            fileExtension = ".jpg";
        }
    }

    // Setup the canvas
    let chartNode = new ChartjsNode(chartWidth, chartHeight);

    // Main processing
    chartNode.drawChart(chartJsOptions)

        .then(next => {
            // chart is created
            // get image as jpeg buffer
            return chartNode.getImageBuffer(contentType);

        }, err => {
            chartNode.destroy();
            return callback(new Error("[InternalServerError] Unable to process supplied JSON payload.  Refer to http://www.chartjs.org/ and https://github.com/vmpowerio/chartjs-node for payload syntax."));
        })

        .then(next => {
            return chartNode.getImageStream(contentType);

        }, err => {
            chartNode.destroy();
            return callback(new Error("[InternalServerError] Unable to obtain necessary charting resources (ImageBuffer).  See log for details."));
        })

        .then(next => {
            // Get the resulting stream from the previous step
            let streamResult = next;
            streamResult.stream.length = streamResult.length;

            let fname = (ShortID.generate()) + fileExtension;
            s3Key = s3prefix + fname;

            let params = {
                Bucket: s3Bucket,
                Key: s3Key,
                Body: streamResult.stream,
                ACL: "private"
            };
            return S3.putObject(params).promise();

        }, err => {
            chartNode.destroy();
            return callback(new Error("[InternalServerError] Unable to obtain necessary charting resources (ImageStream).  See log for details."));
        })

        .then(next => {

            // Compute Pre-signed URL.  This is synchronous.
            let signedUrl = S3.getSignedUrl('getObject', {
                Bucket: s3Bucket,
                Key: s3Key,
                Expires: expireTime
            });
            console.log(signedUrl);
            chartNode.destroy();
            return callback(null, signedUrl);

        }, err => {
            chartNode.destroy();
            return callback(new Error("[Forbidden] Unable to store chart image in S3 Bucket '" + s3Bucket + "'"));
        })

}  // end exports.getGraph
