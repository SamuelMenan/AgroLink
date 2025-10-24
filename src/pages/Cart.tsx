export default function Cart() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Carrito</h1>
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between rounded-md border border-green-100 bg-white p-4 shadow-sm">
          <div>
            <p className="font-medium">Producto de ejemplo</p>
            <p className="text-sm text-gray-600">Cantidad: 1</p>
          </div>
          <p className="font-semibold">$10.00</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="rounded-md bg-green-600 px-4 py-2.5 text-white shadow hover:bg-green-700">Proceder al pago</button>
      </div>
    </main>
  )
}
