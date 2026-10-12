import { demoSignInAction } from "@/app/actions";
import { SubmitButton } from "./submit-button";

// One click into the shared PayPal-sandbox demo account (for judges).
export function DemoButton({ className = "button button-quiet" }: { className?: string }) {
  return (
    <form action={demoSignInAction}>
      <SubmitButton className={className} pendingLabel="Opening the demo">
        Try the demo - no sign-up
      </SubmitButton>
    </form>
  );
}
