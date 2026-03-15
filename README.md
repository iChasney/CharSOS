# CharSOS


## Compile the AWS Lambda Deploy

Install Node Packages

```cd /c/repos/CharSOS/lambda && npm install```

Zip up

```cd /c/repos/CharSOS/lambda && zip -r ../lambda-deploy.zip index.mjs package.json node_modules/```

```cd /c/repos/CharSOS/lambda && powershell.exe -Command "Compress-Archive -Path 'index.mjs','package.json','node_modules' -DestinationPath '../lambda-deploy.zip' -Force"```


## Install Node

```winget install OpenJS.NodeJS.LTS```
