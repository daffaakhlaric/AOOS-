"use client";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import styles from "@/components/auth/LoginForm.module.css";
import pageStyles from "../login/page.module.css";

export default function RegisterPage(): React.ReactElement {
  return (
    <main className={pageStyles.main}>
      <div className={styles.card}>
        <div className={styles.wordmark}>
          <BrandLogo />
        </div>
        <h1 className={styles.title}>Mulai dengan SkorPintar</h1>
        <p className={styles.subtitle}>Satu workspace untuk campaign dan keputusan iklan Anda.</p>
        <form
          onSubmit={(event) => event.preventDefault()}
          className={styles.form}
          aria-describedby="registration-status"
        >
          <label className={styles.field}>
            Name
            <input className={styles.input} name="name" autoComplete="name" required />
          </label>
          <label className={styles.field}>
            Work Email
            <input
              className={styles.input}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className={styles.field}>
            Workspace / Company
            <input className={styles.input} name="company" autoComplete="organization" required />
          </label>
          <label className={styles.field}>
            Password
            <input
              className={styles.input}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className={styles.field}>
            Confirm Password
            <input
              className={styles.input}
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <p id="registration-status" className={styles.subtitle}>
            Pendaftaran mandiri belum tersedia. Hubungi admin perusahaan Anda untuk mendapatkan akun
            dan akses workspace. Data form ini belum dikirim atau disimpan.
          </p>
          <button className={styles.submitButton} type="button" disabled>
            Daftar — melalui admin workspace
          </button>
        </form>
        <p className={styles.subtitle}>
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </div>
    </main>
  );
}
