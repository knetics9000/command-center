import ShareLander from "./ShareLander";

export const dynamic = "force-dynamic";

// Landing route the Web Share Target sends shared content to (/share?title&text&url).
export default function SharePage({ searchParams }) {
  const sp = searchParams || {};
  return <ShareLander title={sp.title || ""} text={sp.text || ""} url={sp.url || ""} />;
}
