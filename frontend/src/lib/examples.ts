export interface CompareExample {
  id: string
  label: string
  left: string
  right: string
  ignoreKeys: string
}

export const ALICE_EXAMPLE: CompareExample = {
  id: 'alice',
  label: 'Alice sample',
  left: `{
  "name": "Alice",
  "age": 30,
  "active": true
}`,
  right: `{
  "name": "Alice",
  "age": 31,
  "role": "admin"
}`,
  ignoreKeys: '',
}

export const COMPARE_EXAMPLES: CompareExample[] = [
  ALICE_EXAMPLE,
  {
    id: 'api-response',
    label: 'API response',
    left: `{
  "id": "usr_01",
  "email": "ada@example.com",
  "status": "active",
  "plan": "free",
  "requestId": "req-aaa",
  "updatedAt": "2026-09-01T12:00:00Z"
}`,
    right: `{
  "id": "usr_01",
  "email": "ada@example.com",
  "status": "active",
  "plan": "pro",
  "requestId": "req-bbb",
  "updatedAt": "2026-09-09T18:30:00Z"
}`,
    ignoreKeys: 'requestId, updatedAt',
  },
  {
    id: 'package-json',
    label: 'package.json',
    left: `{
  "name": "json-compare",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.22.0"
  }
}`,
    right: `{
  "name": "json-compare",
  "version": "1.1.0",
  "private": true,
  "dependencies": {
    "react": "^19.0.0",
    "react-router-dom": "^6.22.0",
    "codemirror": "^6.0.1"
  }
}`,
    ignoreKeys: '',
  },
  {
    id: 'config',
    label: 'Config + updatedAt',
    left: `{
  "env": "staging",
  "featureFlags": {
    "newCheckout": false,
    "rateLimit": true
  },
  "revision": 12,
  "updatedAt": "2026-08-15T09:00:00Z"
}`,
    right: `{
  "env": "production",
  "featureFlags": {
    "newCheckout": true,
    "rateLimit": true
  },
  "revision": 18,
  "updatedAt": "2026-09-09T10:00:00Z"
}`,
    ignoreKeys: 'updatedAt',
  },
]
