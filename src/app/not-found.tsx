import Link from "next/link";

export default function NotFound() {
  return (
    <div className="facade mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="tnum text-[40px] font-extrabold text-lilac">404</p>
      <h1 className="text-[18px] font-bold text-ink">Página não encontrada</h1>
      <p className="text-[13.5px] text-ink-soft">O endereço não existe neste painel.</p>
      <Link href="/dashboard" className="mt-2 rounded-full border border-seam-strong px-4 py-2 text-[13.5px] font-semibold text-ink hover:border-seam-lit">
        Voltar para a Home
      </Link>
    </div>
  );
}
