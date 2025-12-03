interface FooterLinksProps {
  links: { label: string; href: string }[];
}

export function FooterLinks({ links }: FooterLinksProps) {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-4 text-sm text-[#666666] sm:px-6">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-[#111111]">
            {link.label}
          </a>
        ))}
      </div>
    </footer>
  );
}

export default FooterLinks;
