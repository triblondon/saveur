import { redirect } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import homeStyles from "@/app/styles/home.module.css";
import styles from "@/components/styles/auth-form.module.css";

export default async function AuthPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <section className={homeStyles.loggedOutShell}>
      <div className={styles.authStack}>
        <AppLogo iconSize={58} textClassName={homeStyles.loggedOutWordmark} />
        <AuthForm />
      </div>
    </section>
  );
}
