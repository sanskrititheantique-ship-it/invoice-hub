// Jump straight to an invoice by its number. A plain form, so it works without JavaScript.
export default function FindBox({ biz }: { biz?: string }) {
  return (
    <form action="/find" method="get" className="findbox" role="search">
      {biz && <input type="hidden" name="biz" value={biz} />}
      <input id="findNo" name="q" aria-label="Invoice number" placeholder="Go to invoice no." autoComplete="off" required />
      <button className="btn sm" aria-label="Find invoice">Go</button>
    </form>
  );
}
