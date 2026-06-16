export default function AutoLayoutPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src="/tools/block-diagram.html"
        title="Tạo layout mặt bằng"
        className="h-full w-full border-0"
      />
    </div>
  );
}
