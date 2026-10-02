"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ContactFormLabels = {
  name: string;
  email: string;
  order: string;
  subject: string;
  message: string;
  submit: string;
  sending: string;
  success: string;
  error: string;
};

/**
 * Contact form. Posts to `/api/contact`, which validates, rate-limits, forwards
 * to Resend and acknowledges the sender. Nothing is stored in the browser.
 */
export function ContactForm({ labels }: { labels: ContactFormLabels }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setPending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        toast.error(labels.error);
        return;
      }
      form.reset();
      setSent(true);
      toast.success(labels.success);
    } catch {
      toast.error(labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-name">{labels.name}</Label>
          <Input id="contact-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className="h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-email">{labels.email}</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="h-11"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-order">{labels.order}</Label>
        <Input id="contact-order" name="orderNumber" maxLength={60} className="h-11" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-subject">{labels.subject}</Label>
        <Input id="contact-subject" name="subject" required minLength={2} maxLength={120} className="h-11" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-body">{labels.message}</Label>
        <Textarea id="contact-body" name="body" required minLength={10} maxLength={2000} rows={6} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {labels.sending}
            </>
          ) : (
            <>
              <Send className="size-4 rtl-flip" aria-hidden="true" />
              {labels.submit}
            </>
          )}
        </Button>
        {sent ? <p className="text-muted-foreground text-xs">{labels.success}</p> : null}
      </div>
    </form>
  );
}