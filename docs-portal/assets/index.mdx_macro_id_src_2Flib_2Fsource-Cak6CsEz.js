import{r as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./jsx-runtime-NZYk81nU.js";var n=e(t()),r={title:`Cosign Agent API`,description:`Let your AI agents pay stores through PayPal, within rules you co-sign.`},i=`

**Cosign is a company card for AI agents, built on PayPal.** An owner gives each agent a permission slip - a budget, a per-purchase limit, an amount above which they want to be asked, and the stores it may use. Your agent asks Cosign to pay; Cosign checks the slip, and PayPal pays the store straight from the owner's budget hold. Your agent never sees PayPal credentials.

Everything here runs on the **PayPal sandbox** - no real money moves.

## The whole job in three calls [#the-whole-job-in-three-calls]

1. **Get a token** - exchange the agent's API key for a 15-minute token.
2. **Check the allowance** - what is left this period, the limits, and the stores you can pay.
3. **Ask to pay** - the answer is *paid*, *waiting for the owner*, or *blocked* with reasons.

A deterministic rules engine decides first; an AI purchase check can only make a decision stricter. If the owner must approve, poll the spend request until they decide.

## What is included [#what-is-included]

<Cards>
  <Card title="Context Plugin">
    Teaches coding agents like Claude Code, Cursor and GitHub Copilot to integrate an agent with Cosign correctly.
  </Card>

  <Card title="SDKs" href="/sdks">
    Typed client libraries with authentication built in.
  </Card>

  <Card title="API Reference">
    Every endpoint with SDK code samples, and a playground.
  </Card>

  <Card title="Agent-Friendly Docs" href="/llms.txt">
    Full Markdown docs plus \`llms.txt\`, ready to hand to any AI assistant.
  </Card>
</Cards>

## Learn more [#learn-more]

* Source code: [github.com/Osteeen/cosign](https://github.com/Osteeen/cosign)
* MCP: MCP-capable assistants can connect at \`/api/mcp\` with the agent key as a bearer token.
`,a={contents:[{heading:void 0,content:`**Cosign is a company card for AI agents, built on PayPal.** An owner gives each agent a permission slip - a budget, a per-purchase limit, an amount above which they want to be asked, and the stores it may use. Your agent asks Cosign to pay; Cosign checks the slip, and PayPal pays the store straight from the owner's budget hold. Your agent never sees PayPal credentials.`},{heading:void 0,content:`Everything here runs on the **PayPal sandbox** - no real money moves.`},{heading:`the-whole-job-in-three-calls`,content:`**Get a token** - exchange the agent's API key for a 15-minute token.`},{heading:`the-whole-job-in-three-calls`,content:`**Check the allowance** - what is left this period, the limits, and the stores you can pay.`},{heading:`the-whole-job-in-three-calls`,content:`**Ask to pay** - the answer is *paid*, *waiting for the owner*, or *blocked* with reasons.`},{heading:`the-whole-job-in-three-calls`,content:`A deterministic rules engine decides first; an AI purchase check can only make a decision stricter. If the owner must approve, poll the spend request until they decide.`},{heading:`what-is-included`,content:`Teaches coding agents like Claude Code, Cursor and GitHub Copilot to integrate an agent with Cosign correctly.`},{heading:`what-is-included`,content:`Typed client libraries with authentication built in.`},{heading:`what-is-included`,content:`Every endpoint with SDK code samples, and a playground.`},{heading:`what-is-included`,content:"Full Markdown docs plus `llms.txt`, ready to hand to any AI assistant."},{heading:`learn-more`,content:`Source code: github.com/Osteeen/cosign`},{heading:`learn-more`,content:"MCP: MCP-capable assistants can connect at `/api/mcp` with the agent key as a bearer token."}],headings:[{id:`the-whole-job-in-three-calls`,content:`The whole job in three calls`},{id:`what-is-included`,content:`What is included`},{id:`learn-more`,content:`Learn more`}]},o=[{depth:2,url:`#the-whole-job-in-three-calls`,title:(0,n.jsx)(n.Fragment,{children:`The whole job in three calls`})},{depth:2,url:`#what-is-included`,title:(0,n.jsx)(n.Fragment,{children:`What is included`})},{depth:2,url:`#learn-more`,title:(0,n.jsx)(n.Fragment,{children:`Learn more`})}];function s(e){let t={a:`a`,code:`code`,em:`em`,h2:`h2`,li:`li`,ol:`ol`,p:`p`,strong:`strong`,ul:`ul`,...e.components},{Card:r,Cards:i}=t;return r||l(`Card`,!0),i||l(`Cards`,!0),(0,n.jsxs)(n.Fragment,{children:[(0,n.jsxs)(t.p,{children:[(0,n.jsx)(t.strong,{children:`Cosign is a company card for AI agents, built on PayPal.`}),` An owner gives each agent a permission slip - a budget, a per-purchase limit, an amount above which they want to be asked, and the stores it may use. Your agent asks Cosign to pay; Cosign checks the slip, and PayPal pays the store straight from the owner's budget hold. Your agent never sees PayPal credentials.`]}),`
`,(0,n.jsxs)(t.p,{children:[`Everything here runs on the `,(0,n.jsx)(t.strong,{children:`PayPal sandbox`}),` - no real money moves.`]}),`
`,(0,n.jsx)(t.h2,{id:`the-whole-job-in-three-calls`,children:`The whole job in three calls`}),`
`,(0,n.jsxs)(t.ol,{children:[`
`,(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.strong,{children:`Get a token`}),` - exchange the agent's API key for a 15-minute token.`]}),`
`,(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.strong,{children:`Check the allowance`}),` - what is left this period, the limits, and the stores you can pay.`]}),`
`,(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.strong,{children:`Ask to pay`}),` - the answer is `,(0,n.jsx)(t.em,{children:`paid`}),`, `,(0,n.jsx)(t.em,{children:`waiting for the owner`}),`, or `,(0,n.jsx)(t.em,{children:`blocked`}),` with reasons.`]}),`
`]}),`
`,(0,n.jsx)(t.p,{children:`A deterministic rules engine decides first; an AI purchase check can only make a decision stricter. If the owner must approve, poll the spend request until they decide.`}),`
`,(0,n.jsx)(t.h2,{id:`what-is-included`,children:`What is included`}),`
`,(0,n.jsxs)(i,{children:[(0,n.jsx)(r,{title:`Context Plugin`,children:(0,n.jsx)(t.p,{children:`Teaches coding agents like Claude Code, Cursor and GitHub Copilot to integrate an agent with Cosign correctly.`})}),(0,n.jsx)(r,{title:`SDKs`,href:`/sdks`,children:(0,n.jsx)(t.p,{children:`Typed client libraries with authentication built in.`})}),(0,n.jsx)(r,{title:`API Reference`,children:(0,n.jsx)(t.p,{children:`Every endpoint with SDK code samples, and a playground.`})}),(0,n.jsx)(r,{title:`Agent-Friendly Docs`,href:`/llms.txt`,external:!0,children:(0,n.jsxs)(t.p,{children:[`Full Markdown docs plus `,(0,n.jsx)(t.code,{children:`llms.txt`}),`, ready to hand to any AI assistant.`]})})]}),`
`,(0,n.jsx)(t.h2,{id:`learn-more`,children:`Learn more`}),`
`,(0,n.jsxs)(t.ul,{children:[`
`,(0,n.jsxs)(t.li,{children:[`Source code: `,(0,n.jsx)(t.a,{href:`https://github.com/Osteeen/cosign`,children:`github.com/Osteeen/cosign`})]}),`
`,(0,n.jsxs)(t.li,{children:[`MCP: MCP-capable assistants can connect at `,(0,n.jsx)(t.code,{children:`/api/mcp`}),` with the agent key as a bearer token.`]}),`
`]})]})}function c(e={}){let{wrapper:t}=e.components||{};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(s,{...e})}):s(e)}function l(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}export{i as _markdown,c as default,r as frontmatter,a as structuredData,o as toc};