import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { SiteFooter } from "@/components/site-footer";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <ForgotPasswordForm />
      </div>
      <SiteFooter />
    </div>
  );
}
