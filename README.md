# Thor-Web Framework

This framework is a light-weight, easy to use library. It provided most commonly used middlewares to let you can develop a full featured web application.


# Getting start:

## Create web project

```npx thor-web <project-name>```


## Generated project structure:

```
project-folder
   package.json
   README.md
   LICENSE
   index.mjs
 + www
     index.html
 + controllers
     about.mjs
     echo.mjs
 + templates
     about.html  
```

## Start the project
```
node .
```
or
```
npm start
```

# Middlewares

* Session: Control user login status
* Security: Control authorization access
* Body Parser: Provide methods to access request contents
* Controller: Route request to controller js file
* Static: Provide static resources access
* Template: Provide js template render method (Powered by thor-tpl)

