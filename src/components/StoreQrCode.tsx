import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/url";

export async function StoreQrCode({ slug }: { slug: string }) {
  const baseUrl = await getBaseUrl();
  const storeUrl = `${baseUrl}/store/${slug}`;
  const dataUrl = await QRCode.toDataURL(storeUrl, {
    width: 320,
    margin: 1,
    color: { dark: "#171717", light: "#ffffff" },
  });

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR code linking to ${storeUrl}`} className="h-48 w-48" />
      <a
        href={storeUrl}
        target="_blank"
        rel="noreferrer"
        className="break-all text-sm font-medium text-neutral-700 underline"
      >
        {storeUrl}
      </a>
      <a
        href={dataUrl}
        download={`resin-store-qr-${slug}.png`}
        className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
      >
        Download QR code
      </a>
    </div>
  );
}
