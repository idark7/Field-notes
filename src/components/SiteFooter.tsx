export function SiteFooter() {
  return (
    <footer className="px-6 py-10" style={{ background: "#101828" }}>
      <div className="mx-auto flex max-w-[1232px] flex-col gap-10">
        <div className="mx-auto flex w-full max-w-[896px] flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "rgba(255, 255, 255, 0.1)" }}
          >
            <img
              src="/assets/figma/subscribe-envelope.svg"
              alt=""
              className="h-8 w-8"
            />
          </div>
          <h2 className="mt-6 text-[32px] font-medium leading-[40px] text-white md:text-[48px] md:leading-[48px]">
            Subscribe to Field Notes
          </h2>
          <p
            className="mt-4 text-[18px] leading-[30px] md:text-[20px] md:leading-[32.5px]"
            style={{ color: "#d1d5dc" }}
          >
            Get our latest stories delivered to your inbox. Join thousands of travelers discovering
            the world through authentic experiences.
          </p>
          <form
            action="/api/subscribe"
            method="post"
            className="mt-10 flex w-full flex-col items-stretch gap-4 md:flex-row"
          >
            <label className="flex-1">
              <span className="sr-only">Email address</span>
              <input
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
                className="h-[58px] w-full rounded-full border px-6 text-[16px] text-white placeholder:text-[#99a1af]"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
                autoComplete="email"
                data-lpignore="true"
                data-1p-ignore
                suppressHydrationWarning
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-[58px] items-center justify-center gap-3 rounded-full bg-white px-8 text-[16px] font-medium text-[#101828]"
            >
              Subscribe
              <img src="/assets/figma/subscribe-arrow-dark.svg" alt="" className="h-5 w-5" />
            </button>
          </form>
          <p className="mt-5 text-[14px]" style={{ color: "#99a1af" }}>
            No spam. Unsubscribe anytime. We respect your privacy.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <p className="text-[15px] italic" style={{ color: "rgba(255, 255, 255, 0.82)" }}>
            Follow our journey as we curate India&apos;s most unique travel stories.
          </p>
          <p className="text-[14px]" style={{ color: "rgba(255, 255, 255, 0.82)" }}>
            Contact Us:{" "}
            <a href="mailto:hello@greatdtour.com" className="underline">
              hello@greatdtour.com
            </a>
          </p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/profile.php?id=61583154056838"
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: "1px solid rgba(255, 255, 255, 0.2)" }}
            >
              <img
                src="/assets/figma/akar-icons-facebook-fill.svg"
                alt=""
                className="h-6 w-6"
              />
            </a>
            <a
              href="https://www.instagram.com/greatdtour/"
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: "1px solid rgba(255, 255, 255, 0.2)" }}
            >
              <img
                src="/assets/figma/akar-icons-instagram-fill.svg"
                alt=""
                className="h-6 w-6"
              />
            </a>
            <a
              href="https://www.linkedin.com/company/greatdtour"
              aria-label="LinkedIn"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: "1px solid rgba(255, 255, 255, 0.2)" }}
            >
              <img
                src="/assets/figma/akar-icons-linkedin-box-fill.svg"
                alt=""
                className="h-6 w-6"
              />
            </a>
          </div>
          <p className="text-[14px]" style={{ color: "rgba(255, 255, 255, 0.68)" }}>
            All Rights Reserved by Chomps Innovation Labs LLP, Bengaluru, India
          </p>
        </div>
      </div>
    </footer>
  );
}
