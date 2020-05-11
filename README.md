# Thor-Web Framework

This framework is a light-weight, easy to use library. It provided most commonly used middlewares to let you can develop a full featured web application.

# Example

## Create a deme project:

```
demo-project
   package.json
   index.mjs
 + www
     index.html
 + controllers
     about.mjs
 + templates
     about.html  
```

## Edit package.json
```json
{
  "name": "web-demo",
  "version": "1.0.0",
  "main": "index.mjs",
  "type": "module",
  "dependencies": {
    "thor-web": "1.0.0"
  }
}
```

## Install
```
npm install
```

## index.mjs
```js
import { start } from 'thor-web';
start();
``` 

## index.html
```html
<DOCTTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Web Demo</title>
  </head>
  <body>
    <h1>Demo</h1>
    <p>
      <a href="about">Show Server Info</a>
    </p>
  </body>
</html>
```

## about.html
```html
{{@arg:info}}
<DOCTTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Server Info</title>
  </head>
  <body>
    <h1>Server Info</h1>
    <pre>
      {{info}}
    </pre>
  </body>
</html>
```

## about.mjs
```js
export async function get(ctx) {
  let info = Object.entries(process.env)
    .map(item => item[0] + ':' + item[1])
    .reduce((p,c) => p + '\n' + c, '');
  await ctx.render('about.html', {
    info: info
  });
}
```

## Run
```
node .
```

# Middlewares

* Session: Control user login status
* Security: Control authorization access
* Body Parser: Provide methods to access request contents
* Controller: Route request to controller js file
* Static: Provide static resources access
* Template: Provide js template render method (Powered by thor-tpl)

