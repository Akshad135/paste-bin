
export interface Paste {
    id: number;
    slug: string;
    title: string;
    content: string;
    language: string;
    visibility: 'public' | 'private';
    pinned: number;
    preview?: string;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

const now = new Date();
const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);

const formatDate = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

const NOW = formatDate(now);
const FUTURE_EXPIRY = formatDate(future);

export const DEMO_PASTES: Paste[] = [
    // 1. Pinned - Edgy Humor (Fake Keys)
    {
        id: 1,
        slug: 'claude-keys-exposed',
        title: "claude_api_keys.txt",
        language: "text",
        visibility: "public",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: 'sk-ant-api03-Md8...',
        content: `sk-ant-api03-Md8...7d9s-8d7f6g5h4j3k2l1
sk-ant-api03-Kp2...9a8s-1d2f3g4h5j6k7l8
# DO NOT SHARE THESE KEYS!!
# usage: export CLAUDE_API_KEY=...
# for akshad135's internal use only`,
    },

    // 2. Pinned - Edgy Humor (Fake DB)
    {
        id: 2,
        slug: 'prod-db-credentials',
        title: "prod_db_config.json",
        language: "json",
        visibility: "public",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '{\n  "host": "production-db.cluster-ro-...",\n  "port": 5432...',
        content: `{
  "host": "production-db.cluster-ro-akshad135.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "database": "users_prod",
  "user": "admin",
  "password": "correct-horse-battery-staple-123!",
  "ssl": true,
  "pool": {
    "min": 2,
    "max": 10
  }
}`,
    },

    // 3. Pinned - Proper (Dotfiles)
    {
        id: 3,
        slug: 'dotfiles-setup',
        title: "dotfiles/README.md",
        language: "markdown",
        visibility: "public",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '# My Dotfiles\n\nAutomated setup key for my development environment...',
        content: `# My Dotfiles

Automated setup key for my development environment.

## Installation

\`\`\`bash
git clone https://github.com/akshad135/dotfiles.git
cd dotfiles
./install.sh
\`\`\`

## Features

- **Neovim**: Custom Lua config with LSP
- **Zsh**: Oh-My-Zsh with Powerlevel10k
- **Tmux**: Productivity binding
- **Git**: Aliases for rapid workflow

## Requirements

- Linux/macOS
- Nerd Fonts patched terminal`,
    },

    // 4. Pinned - Proper (Competitive Programming)
    {
        id: 4,
        slug: 'cp-template-cpp',
        title: "algo_template.cpp",
        language: "cpp",
        visibility: "public",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '#include <bits/stdc++.h>\nusing namespace std;\n\ntypedef long long ll;...',
        content: `#include <bits/stdc++.h>
using namespace std;

typedef long long ll;
typedef vector<int> vi;
typedef pair<int, int> pii;

#define F first
#define S second
#define PB push_back
#define MP make_pair
#define REP(i, a, b) for (int i = a; i <= b; i++)

void solve() {
    int n, k;
    cin >> n >> k;
    vi v(n);
    for (int &x : v) cin >> x;
    
    sort(v.begin(), v.end());
    
    // Logic goes here
    // optimized for akshad135's workflow
    
    cout << "YES\\n";
}

int main() {
    ios::sync_with_stdio(0);
    cin.tie(0);
    
    int t;
    cin >> t;
    while (t--) {
        solve();
    }
    return 0;
}`,
    },

    // 5. Proper - TypeScript
    {
        id: 5,
        slug: 'stripe-webhook-handler',
        title: "stripe_webhook.ts",
        language: "typescript",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: FUTURE_EXPIRY,
        preview: 'import Stripe from "stripe";\nimport { buffer } from "micro";...',
        content: `import Stripe from "stripe";
import { buffer } from "micro";
import { NextApiRequest, NextApiResponse } from "next";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const buf = await buffer(req);
    const sig = req.headers["stripe-signature"]!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        buf.toString(),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      // Log error to monitoring
      console.log(\`❌ Error message: \${errorMessage}\`);
      res.status(400).send(\`Webhook Error: \${errorMessage}\`);
      return;
    }

    console.log("✅ Success:", event.id);

    if (event.type === "checkout.session.completed") {
      const subscription = event.data.object as Stripe.Checkout.Session;
      // Grant access to user
    }

    res.json({ received: true });
  } else {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
  }
}`,
    },

    // 6. Proper - Python
    {
        id: 6,
        slug: 'django-settings-base',
        title: "settings.py",
        language: "python",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: 'import os\nfrom pathlib import Path\n\nBASE_DIR = Path(__file__).resolve().parent.parent...',
        content: `import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-default-key-change-me")

DEBUG = os.getenv("DEBUG", "False") == "True"

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "api",
    "core", // Main logic by akshad135
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"`,
    },

    // 7. Proper - Nginx
    {
        id: 7,
        slug: 'nginx-reverse-proxy',
        title: "nginx.conf",
        language: "nginx",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: 'server {\n    listen 80;\n    server_name api.example.com;\n...',
        content: `server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-XSS-Protection "1; mode=block";
    }
}`,
    },

    // 8. Proper - YAML
    {
        id: 8,
        slug: 'docker-compose-stack',
        title: "docker-compose.yml",
        language: "yaml",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: FUTURE_EXPIRY,
        preview: 'version: "3.8"\n\nservices:\n  app:\n    build: .\n    ports: ...',
        content: `version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=mydb

  redis:
    image: redis:7-alpine

  worker:
    build: .
    command: npm run worker
    depends_on:
      - db
      - redis

volumes:
  postgres_data:`,
    },

    // 9. Proper - Log
    {
        id: 9,
        slug: 'cargo-build-failure',
        title: "cargo-build.log",
        language: "text", // closest to log
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: 'error[E0382]: use of moved value: `content`\n  --> src/main.rs:42:20...',
        content: `error[E0382]: use of moved value: \`content\`
  --> src/main.rs:42:20
   |
35 |     let content = String::from("hello");
   |         ------- move occurs because \`content\` has type \`String\`, which does not implement the \`Copy\` trait
...
41 |     process_data(content);
   |                  ------- value moved here
42 |     println!("{}", content);
   |                    ^^^^^^^ value borrowed here after move
   |
help: consider cloning the value if the performance cost is acceptable
   |
41 |     process_data(content.clone());
   |                         ++++++++

error: aborting due to previous error

For more information about this error, try \`rustc --explain E0382\`.
error: could not compile \`paste-bin\` due to previous error`,
    },

    // 10. Proper - GraphQL
    {
        id: 10,
        slug: 'graphql-schema-def',
        title: "schema.graphql",
        language: "graphql",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: 'type User {\n  id: ID!\n  username: String!\n  email: String!\n...',
        content: `type User {
  id: ID!
  username: String!
  email: String!
  avatarUrl: String
  posts: [Post!]!
  createdAt: String!
}

type Post {
  id: ID!
  title: String!
  content: String!
  published: Boolean!
  author: User!
  comments: [Comment!]!
}

type Comment {
  id: ID!
  text: String!
  author: User!
}

type Query {
  me: User
  feed(offset: Int, limit: Int): [Post!]!
  post(id: ID!): Post
}

type Mutation {
  createPost(title: String!, content: String!): Post!
  publishPost(id: ID!): Post
  deletePost(id: ID!): Boolean
}

schema {
  query: Query
  mutation: Mutation
}`,
    },

    // 11. Proper - Solidity
    {
        id: 11,
        slug: 'eth-payment-contract',
        title: "PaymentChannel.sol",
        language: "solidity",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract SimplePaymentChannel...',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimplePaymentChannel {
    address payable public sender;
    address payable public recipient;
    uint256 public expiration;

    constructor(address payable _recipient, uint256 duration) payable {
        sender = payable(msg.sender);
        recipient = _recipient;
        expiration = block.timestamp + duration;
    }

    function close(uint256 amount, bytes memory signature) external {
        require(msg.sender == recipient);
        require(isValidSignature(amount, signature));

        recipient.transfer(amount);
        selfdestruct(sender);
    }

    function extend(uint256 newExpiration) external {
        require(msg.sender == sender);
        require(newExpiration > expiration);
        expiration = newExpiration;
    }

    function claimTimeout() external {
        require(block.timestamp >= expiration);
        selfdestruct(sender);
    }

    function isValidSignature(uint256 amount, bytes memory signature)
        internal
        view
        returns (bool)
    {
        bytes32 message = prefixed(keccak256(abi.encodePacked(this, amount)));
        return recoverSigner(message, signature) == sender;
    }
    
    // Internal helper functions omitted for brevity
}`,
    },

    // 12. Edgy - Kernel Panic
    {
        id: 12,
        slug: 'sysadmin-nightmare',
        title: "kernel_panic.txt",
        language: "text",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: 'Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)...',
        content: `Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)
CPU: 0 PID: 1 Comm: swapper/0 Not tainted 5.15.0-76-generic #83-Ubuntu
Hardware name: QEMU Standard PC (i440FX + PIIX, 1996), BIOS 1.13.0-1ubuntu1.1 04/01/2014
Call Trace:
 <TASK>
 dump_stack_lvl+0x4a/0x63
 dump_stack+0x10/0x16
 panic+0x14c/0x321
 mount_block_root+0x2c6/0x2d5
 mount_root+0x38/0x3a
 prepare_namespace+0x13f/0x191
 kernel_init_freeable+0x25f/0x289
 ? rest_init+0xd0/0xd0
 kernel_init+0x16/0x120
 ret_from_fork+0x22/0x30
 </TASK>
Kernel Offset: 0x36000000 from 0xffffffff81000000 (relocation range: 0xffffffff80000000-0xffffffffbfffffff)
---[ end Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0) ]---`,
    },

    // 13. Edgy - CSS Hack
    {
        id: 13,
        slug: 'css-is-awesome',
        title: "weird_hacks.css",
        language: "css",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '/* Do not touch this file unless you want to break IE11 support */\n\n* { box-sizing: border-box; }...',
        content: `/* Do not touch this file unless you want to break IE11 support */

* { box-sizing: border-box; }

/* The "Holy Grail" Centering Hack */
.absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Clearfix because floats are still a thing apparently */
.clearfix::after {
  content: "";
  display: table;
  clear: both;
}

/* Comic Sans for critical errors to reduce panic */
.error-message {
  font-family: "Comic Sans MS", "Chalkboard SE", sans-serif !important;
  color: red;
  font-weight: bold;
}

/* Hide scrollbar but keep functionality */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Akshad135's secret sauce */
.glass-morphism {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}`,
    },

    // 14. Proper - Assembly
    {
        id: 14,
        slug: 'mbr-bootloader',
        title: "boot.asm",
        language: "assembly", // or nasm
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '; Simple MBR Bootloader\n; BITS 16\n\nstart:\n    mov ax, 07C0h...',
        content: `; Simple MBR Bootloader
; BITS 16

start:
    mov ax, 07C0h       ; Set up 4K stack space after this bootloader
    add ax, 288         ; (4096 + 512) / 16 bytes per paragraph
    mov ss, ax
    mov sp, 4096

    mov ax, 07C0h       ; Set data segment to where we're loaded
    mov ds, ax

    mov si, text_string ; Put string position into SI
    call print_string   ; Call our string-printing routine

    jmp $               ; Jump here - infinite loop!

text_string db 'Hello from Akshad135 OS!', 0

print_string:           ; Routine: output string in SI to screen
    mov ah, 0Eh         ; int 10h 'print char' function

.repeat:
    lodsb               ; Get character from string
    cmp al, 0
    je .done            ; If char is zero, end of string
    int 10h             ; Otherwise, print it
    jmp .repeat

.done:
    ret

times 510-($-$$) db 0   ; Pad remainder of 512 bytes with 0s
dw 0AA55h               ; The standard PC boot signature`,
    },

    // 15. Proper - JSON UI Config
    {
        id: 15,
        slug: 'ui-theme-config',
        title: "shadcn-components.json",
        language: "json",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '{\n  "$schema": "https://ui.shadcn.com/schema.json",\n  "style": "new-york",\n...',
        content: `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  },
  "iconLibrary": "lucide-react",
  "components": [
    "accordion",
    "alert",
    "alert-dialog",
    "aspect-ratio",
    "avatar",
    "badge",
    "button",
    "card",
    "checkbox",
    "collapsible"
  ]
}`,
    },

    // 16. Proper - Markdown Todo
    {
        id: 16,
        slug: 'dev-todo-list',
        title: "TODO.md",
        language: "markdown",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        expires_at: null,
        preview: '# Project Roadmap\n\n## High Priority\n- [x] Fix production DB connection leak\n- [ ] Implement dark mode...',
        content: `# Project Roadmap

## High Priority
- [x] Fix production DB connection leak
- [ ] Implement dark mode (use akshad135's palette)
- [ ] Add unit tests for payment service

## Low Priority
- [ ] Refactor legacy jQuery code
- [ ] Update dependencies
- [ ] Write documentation

## Ideas
- Add AI-powered code completion?
- Build a CLI tool in Rust
- **Star the repo**: don't forget to star the main repo on GitHub!

## Notes
Meeting with stakeholders on Friday at 10 AM. Bring coffee.`,
    },
];
