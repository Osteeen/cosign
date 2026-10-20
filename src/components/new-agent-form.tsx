"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { validateForm } from "@/lib/client/validate";
import { FieldError, invalidProps } from "./field-error";
import { createAgentAction, type NewAgentState } from "@/app/actions";
import { ConnectAgent } from "./connect-agent";
import { CopyButton } from "./copy-button";
import { SubmitButton } from "./submit-button";

export function NewAgentForm({ appUrl }: { appUrl: string }) {
  const [state, formAction] = useActionState<NewAgentState, FormData>(createAgentAction, { status: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (state.status === "created") {
    const key = `${state.keyId}:${state.secret}`;
    return (
      <div className="panel-stack">
        <h1 className="panel-title">{state.agentName} is added</h1>
        <div className="key-reveal" role="region" aria-label="Agent API key">
          <p className="field-label">API key - copy it now</p>
          <code className="key-value">{key}</code>
          <p className="muted">
            This is the only time you will see it. Give it to your AI assistant. It uses the key to check with Cosign before paying. If you lose
            it, revoke the agent and add a new one.
          </p>
          <CopyButton value={key} label="Copy key" />
        </div>
        <ConnectAgent agentId={state.agentId} apiKey={key} appUrl={appUrl} />
        <Link href={`/agents/${state.agentId}/slip`} className="button button-primary">
          Give it a permission slip
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="panel-title">Add an agent</h1>
      <p className="panel-text">Name the AI assistant you want to let spend. You will get a key for it, then give it a permission slip.</p>
    <form
      action={formAction}
      className="slip panel-stack"
      noValidate
      onSubmit={(e) => {
        const found = validateForm(e.currentTarget);
        setErrors(found);
        if (Object.keys(found).length) e.preventDefault();
      }}
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (errors[name]) setErrors({ ...errors, [name]: "" });
      }}
    >
      <div className="field">
        <label htmlFor="name" className="field-label">
          Agent name
        </label>
        <input id="name" name="name" className="field-input" required maxLength={80} placeholder="Office procurement bot" autoComplete="off" data-label="agent name" {...invalidProps("name", errors)} />
        <FieldError name="name" errors={errors} />
      </div>
      <div className="field">
        <label htmlFor="description" className="field-label">
          What it does (optional)
        </label>
        <input id="description" name="description" className="field-input" maxLength={280} placeholder="Reorders paper and coffee" autoComplete="off" />
      </div>
      {state.status === "error" ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Adding agent">Add agent</SubmitButton>
    </form>
    </>
  );
}
