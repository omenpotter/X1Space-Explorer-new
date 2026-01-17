baseURL: isDevelopment 
  ? 'http://localhost:3000'
  : window.location.origin,  // Use Base44's own domain
```

This way it calls:
```
https://x1space.base44.app/api/getTokens
