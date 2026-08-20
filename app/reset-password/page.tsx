import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SiteFooter } from "@/components/site-footer";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}
