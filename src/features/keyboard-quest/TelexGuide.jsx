const rules = [
  ['s', 'Dấu sắc', 'as → á'],
  ['f', 'Dấu huyền', 'af → à'],
  ['r', 'Dấu hỏi', 'ar → ả'],
  ['x', 'Dấu ngã', 'ax → ã'],
  ['j', 'Dấu nặng', 'aj → ạ'],
  ['aa', 'Mũ chữ a', 'aa → â'],
  ['ee', 'Mũ chữ e', 'ee → ê'],
  ['oo', 'Mũ chữ o', 'oo → ô'],
  ['aw', 'Móc chữ a', 'aw → ă'],
  ['ow', 'Móc chữ o', 'ow → ơ'],
  ['uw', 'Móc chữ u', 'uw → ư'],
  ['dd', 'Chữ đ', 'dd → đ'],
];
export default function TelexGuide() {
  return (
    <details className="quest-telex-guide">
      <summary>Bảng Telex</summary>
      <p>Bật bộ gõ Telex của máy. Các ví dụ dưới đây là hướng dẫn; trang web không tự thay chữ.</p>
      <div
        className="quest-table-scroll"
        role="region"
        aria-label="Bảng quy tắc Telex"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Gõ</th>
              <th>Quy tắc</th>
              <th>Ví dụ</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(([key, label, example]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{label}</td>
                <td>{example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Ví dụ ghép: aas → ấ; tieengs → tiếng; dduowngf → đường; con yeeu mej → con yêu mẹ.</p>
    </details>
  );
}
