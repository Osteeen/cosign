# Cosign Agent API (/)



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
    Full Markdown docs plus `llms.txt`, ready to hand to any AI assistant.
  </Card>
</Cards>

## Learn more [#learn-more]

* Source code: [github.com/Osteeen/cosign](https://github.com/Osteeen/cosign)
* MCP: MCP-capable assistants can connect at `/api/mcp` with the agent key as a bearer token.
