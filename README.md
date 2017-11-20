# chartjs-lambda

A simple package to make it easy to create **Chartjs** charts on Amazon Web Services (AWS) **Lambda**.  Charts are dynamically rendered on Lambda using the [chartjs JSON syntax](http://www.chartjs.org/docs/latest/) and an appropriately sized image PNG/JPG file is generated and stored in S3.  Results are available as a time-expiring S3 signed URL.

This library puts together the excellent [chartjs-node](https://github.com/vmpowerio/chartjs-node) and [chartjs](https://github.com/chartjs/Chart.js) to render Chartjs in the [AWS Lambda](https://aws.amazon.com/lambda/) environment.  The library is packaged according to the [AWS Serverless Application Model (SAM)](https://github.com/awslabs/serverless-application-model) specification, and is prebuilt with all the required native dependencies to operate within the Lambda Amazon Linux based container.

## Background

### Why chartjs-lambda

We work quite a bit on analytics projects which call for interesting ways to visualize outputs (from a SQL query on *AWS Redshift* or *Presto* seeking KPI metrics over the last 12 months, for example).  These may include simple tables or bar charts to more sophisticated bubble and scatterplots.  This could be challenging in a  Serverless analytics application where we don't have full control over the client framework or where a standard dashboard just won't cut it.
######
![Sample](https://github.com/agilisium/chartjs-lambda/raw/master/img/chartjs-lambda-chatbot-sample.png)

######

Chatbot kits like *Amazon Lex*, and conversational interfaces like *Amazon Echo Show* and *Google Assistant*, make chart visualization an even more interesting challenge since a common need is to be able to dynamically render an Image URL as a part of a backend service fulfillment request.  If your backend fulfillment is AWS  Lambda then creating these rich media responses becomes that much easier with a package like `chartjs-lambda`.

That said there are always areas for future improvements.  We evaluated other self-hosted kits on Lambda and the native dependencies for generating host-side graphics can drive package sizes and performance further north then we'd like to see in some cases.  We are always open to suggestions on optimization.  Take a look, clone it, fork it, give it spin.  Contributions and ideas are always welcome.  Also if you'd prefer SaaS alternatives consider solutions such as Plot.ly (https://plot.ly/).  We're big fans of their service as well.

### Dependencies

This package has been built for general compatibility with Chartjs 2.6, Amazon Linux AMI amzn-ami-hvm-2017.03.1.20170812-x86_64-gp2 and NodeJS 10.6.  Native libraries have been prebuilt and packaged per the AWS Lambda requirements listed [here](http://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html).

### Deploying

This package is designed to be deployed to AWS Lambda using the AWS Lambda [Serverless Application Model (SAM) framework](https://github.com/awslabs/serverless-application-model).  Once you've pulled down a copy of this repo, upload the prebuilt Lambda package **lib/chartjs-lambda.zip** to an S3 bucket of your choosing.   Make note of the S3 bucket and folder/key.

You will then use the [AWS CLI](https://aws.amazon.com/cli/) to deploy resources and install the Lambda package as required.  A new CORS-enabled S3 bucket will be created in the default region with IAM policies allowing the Lambda ChartJS worker to store image files and generate signed URLs.
```bash
$ aws s3 cp lib/chartjs-lambda.zip s3://<CHANGEME-MYBUCKET>/<CHANGEME-PATH>/chartjs-lambda.zip

$ aws cloudformation deploy --template-file template.yaml --stack-name CHANGME --parameter-overrides LambdaCodeBucketName=<CHANGEME-BUCKET> LambdaCodeKey=<CHANGME-PATH>/chartjs-lambda.zip --capabilities CAPABILITY_IAM

```

You can review the output resources including the identity of the newly provisioned Lambda function.  Make note of the function name or the ARN.  You may use this to invoke the Lambda API from your application.  Look for the **PhysicalResourceId** where  `ResourceType = "AWS::Lambda::Function"`.

```bash
$ aws cloudformation describe-stack-resources --stack-name <CHANGME>


```

## Creating a Chart

Creating a chart is generally the same as building a chart on the client side using **ClientJS**.  You will generate a JSON drawing object conforming to the [Chartjs syntax](http://www.chartjs.org/docs/latest/).  Our service' convention is to provide a named object called "**chartJsOptions**" which contains the desired ChartJS drawing directives.

Here's a NodeJS snippet for creating the sample line chart embedded in the sample chatbot response card in the preceding [figure](https://github.com/agilisium/chartjs-lambda/raw/master/img/chartjs-lambda-chatbot-sample.png).


```js
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
    }
};
```
You could then package this up and invoke from your backend application, proxy, API Gateway or other.



```js
let AWS = require('aws-sdk');
AWS.config.update({region: '...'});
let lambda = new AWS.Lambda({region: '...'});

let payload = JSON.stringify(myRequest);

let params = {
    FunctionName: "<CHANGEME>",                    // Your function name here.
    InvocationType: "RequestResponse",
    LogType: "Tail",
    Payload: payload,
	};

lambda.invoke(params, function (err, data) {       // Call it!
    if (err) console.log(err, err.stack);
    else console.log(data);
});

```

## Parameters

You supply a request object with the `chartJsOptions` component but you may supply additional options to override service defaults.  The list of all current parameters are:

 - **chartJsOptions** [JSON OBJECT]
	 - Description:  main `chartjs` chart rendering directives (version 2.6 syntax).
	 - Reference:   http://www.chartjs.org/docs/latest/.
	 - Mandatory:  **Yes**
 - **chartWidth** [INTEGER:  Pixels]
	 - Description:  Output image width
	 - Mandatory:  No
	 - Default:  480
 - **chartHeight** [INTEGER:  Pixels]
	 - Description:  Output image height
	 - Mandatory:  No
	 - Default:  320
 - **expireTime** [INTEGER:  Seconds]
	 - Description:  S3 signed URL will expire after N seconds.  Maximum per S3 limits is 604800 or 7 days
	 - Mandatory: No
	 - Default:  300
 - **fileFormat** [STRING:  "png"|"jpg"]
	 - Description:  Output content and  file format type
	 - Mandatory:  No
	 - 

### Example


```js

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

```

## Output

Result is a single S3 signed URL served out of the S3 bucket created as a part of the service's CloudFormation deployment.  The S3 bucket is CORS-enabled and scoped to the Lambda Service worker role part of the stack.

    https://<BUCKET-NAME-CREATED-FROM-CF-STACK-NAME>.s3....amazonaws.com/mycharts/image-ryZQ3ayxG.jpg?AWSAccessKeyId=...&Expires=1511753368&Signature=....

# Useful Resources

 1. **Chart.JS**.   Good reference for creating your `chartJsOptions`  .
 http://www.chartjs.org/docs/latest/
 2. **ChartJS-Node**.  The NodeJS engine behind `chartjs-lambda`.  Good read on creating plugins, or if you're interested in building your own binaries for your own image.
 https://github.com/vmpowerio/chartjs-node
 3. **ChartJS-Node Demo Page**.  Use this to explore and validate your `chartJsOptions` object in real time.  http://chartjs-demo.vmpower.io/
 4. **AWS Serverless Application Model (SAM)**.  How-to instructions if you are interested in extending the default `template.yaml` resource.
 https://github.com/awslabs/serverless-application-model/blob/master/HOWTO.md
