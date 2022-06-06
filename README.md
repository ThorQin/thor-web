# Thor-Web Framework

This framework is a light-weight, easy to use library. It provided most commonly used middlewares to let you can develop a full featured web application.

# Getting start:

## Use npm command to create a simple project:

```bash
npx thor-web my-project
```

## Use 'degit' to create the project

1. Create a simplest demo project (same with npx command):

```bash
npx degit ThorQin/thor-web-demo my-project
```

2. Create a full featured project that using Vue3 build front-end web pages:

```bash
npx degit ThorQin/thor-web-vue my-project
```

## Build project

```bash
npm run build
```

## Start the project
```bash
npm start
```

## Use nodemon to debug project
```
npm run debug
```

# Features

* Session: Control user login status
* Security: Control access authorization
* Body Parser: Provide methods to access request contents
* Controller: Route request to controller js file
* Static: Provide static resources access
* Template: Provide js template render method (Powered by thor-tpl)
* WebSocket: Provide WebSocket communication
* Auto generate api-docs page (See vue3 project's demonstration)
