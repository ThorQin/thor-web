# Thor-Web Framework

This framework is a light-weight, easy to use library. It provided most commonly used middlewares to let you can develop a full featured web application.

# Example

## Create a deme project like this:

```
ProjectFolder
   package.json
   index.js
 + www
   + assets
       main.css
     index.html
 + controllers
     about.js
 + templates
     about.html  
```

## Edit package.json
```json
{
  "name": "web-demo",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
	  "thor-web": "1.0.0"
  }
}
```

## Install
```
yarn install
```

## Edit index.js
```js
const web = require('thor-web');
web.start(8080);
``` 

## Edit static file: index.html
```html
<DOCTTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Thor Web Demo</title>
    <link ref="stylesheet" href="/assets/main.css">
  </head>
  <body>
    <h1>Demo</h1>
    <p>
      <a href="/about">Show About</a>
    </p>
  </body>
</html>
```

## Edit static CSS resource: main.css
```css
body {
  font: 18pt;
}
```

## Edit template file: about.html
```html
<DOCTTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>About</title>
    <link ref="stylesheet" href="/assets/main.css">
  </head>
  <body>
    <h1>About</h1>
    <p>
      Version: {{version}}
  </p>
  </body>
</html>
```

## Edit controller file: about.js
```js
console pkg = require('../package.json')
exports.get = async function (ctx) {
  await ctx.render('about.html', {
    version: pkg.version
  });
};
```

## Enjoy it
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
