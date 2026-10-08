// ============================================================
// 룰루랄라 카페 주문서 - script.js
// index.html에 있는 id와 data-price를 그대로 사용합니다.
// ============================================================

// ------------------------------------------------------------
// 0. Supabase 연결 설정
//    아래 두 값은 Supabase 대시보드 > Project Settings > API 에서 복사해 넣으세요.
//    - SUPABASE_URL : Project URL (예: https://xxxx.supabase.co)
//    - SUPABASE_KEY : anon public 키 (service_role 키는 절대 넣지 마세요!)
// ------------------------------------------------------------
const SUPABASE_URL = "";  // TODO: 여기에 Project URL을 넣으세요
const SUPABASE_KEY = "";  // TODO: 여기에 anon public 키를 넣으세요

// index.html 에서 CDN 으로 불러온 supabase-js 가 전역 변수 supabase 를 만들어 줍니다.
// createClient 로 Supabase 와 통신할 "클라이언트"를 만듭니다.
// (값이 비어 있으면 createClient 가 에러를 내서 페이지 전체가 멈추므로, 비어 있을 땐 null 로 둡니다.)
const supabaseClient = (SUPABASE_URL && SUPABASE_KEY)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ------------------------------------------------------------
// 1. HTML 요소 가져오기
//    document.getElementById("아이디") 는 해당 id를 가진 요소를 찾아줍니다.
// ------------------------------------------------------------
const form = document.getElementById("order-form");           // 주문서 전체 폼
const nameInput = document.getElementById("customer-name");   // 이름 입력칸
const phoneInput = document.getElementById("customer-phone"); // 전화번호 입력칸
const drinkSelect = document.getElementById("drink");         // 음료 드롭다운
const quantityInput = document.getElementById("quantity");    // 수량 입력칸
const totalPriceBox = document.getElementById("total-price"); // 예상 금액 표시 영역
const resultBox = document.getElementById("order-result");    // 주문 확인 메시지 영역

// querySelectorAll 은 조건에 맞는 요소를 "전부" 찾아줍니다.
const sizeRadios = document.querySelectorAll('input[name="size"]');        // 사이즈 라디오 3개
const optionChecks = document.querySelectorAll('input[name="options"]');   // 추가 옵션 체크박스 4개

// ------------------------------------------------------------
// 2. 금액 계산 함수 (이 함수 하나로 계산하고, 여러 곳에서 재사용합니다)
//    공식: (음료 가격 + 사이즈 추가금 + 옵션 추가금 합계) × 수량
//    반환값: 총 금액(숫자)
// ------------------------------------------------------------
function calculateTotal() {
  // (1) 음료 가격: 선택된 <option>의 data-price 값을 읽습니다.
  //     dataset.price 는 data-price 속성값을 문자열로 돌려주므로 Number()로 숫자로 바꿉니다.
  const selectedDrink = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkPrice = Number(selectedDrink.dataset.price);

  // 음료를 아직 안 골랐다면(첫 항목은 가격 0) 사이즈/옵션이 있어도 0원으로 표시합니다.
  if (drinkPrice === 0) {
    return 0;
  }

  // (2) 사이즈 추가금: 체크(선택)된 라디오 버튼의 data-price
  const checkedSize = document.querySelector('input[name="size"]:checked');
  const sizePrice = checkedSize ? Number(checkedSize.dataset.price) : 0;

  // (3) 추가 옵션 금액: 체크된 체크박스들의 data-price를 모두 더합니다.
  let optionPrice = 0;
  optionChecks.forEach(function (check) {
    if (check.checked) {
      optionPrice += Number(check.dataset.price);
    }
  });

  // (4) 수량: 1~100 범위로 보정합니다. (비어 있거나 이상한 값이면 1로 처리)
  let quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }
  if (quantity > 100) {
    quantity = 100;
  }

  // (5) 최종 금액 = (음료 + 사이즈 + 옵션) × 수량
  return (drinkPrice + sizePrice + optionPrice) * quantity;
}

// ------------------------------------------------------------
// 3. 예상 금액을 화면에 표시하는 함수
//    toLocaleString() 은 숫자에 천 단위 콤마를 붙여줍니다. (5000 → "5,000")
// ------------------------------------------------------------
function updateTotalPrice() {
  const total = calculateTotal();
  totalPriceBox.textContent = "예상 금액: " + total.toLocaleString() + "원";
}

// ------------------------------------------------------------
// 4. 값이 바뀔 때마다 금액 다시 계산하기
//    - select, radio, checkbox 는 "change" 이벤트 (선택이 바뀔 때)
//    - 수량 입력칸은 "input" 이벤트 (타이핑/화살표 클릭할 때마다)
// ------------------------------------------------------------
drinkSelect.addEventListener("change", updateTotalPrice);
quantityInput.addEventListener("input", updateTotalPrice);

sizeRadios.forEach(function (radio) {
  radio.addEventListener("change", updateTotalPrice);
});

optionChecks.forEach(function (check) {
  check.addEventListener("change", updateTotalPrice);
});

// ------------------------------------------------------------
// 5. 주문하기 (폼 제출) 처리
//    form 의 "submit" 이벤트는 주문하기 버튼을 누르면 발생합니다.
// ------------------------------------------------------------
//    Supabase 저장은 시간이 걸리는 작업이라 async 함수로 만들고, await 로 끝날 때까지 기다립니다.
form.addEventListener("submit", async function (event) {
  // 폼의 기본 동작(페이지 새로고침)을 막습니다.
  event.preventDefault();

  // 입력값 앞뒤 공백은 trim()으로 제거합니다. (공백만 입력한 경우도 "빈 값"으로 처리)
  const customerName = nameInput.value.trim();
  const customerPhone = phoneInput.value.trim();

  // --- 입력 검사: 문제가 있으면 알림을 띄우고 return 으로 함수를 끝냅니다. ---
  if (customerName === "") {
    alert("이름을 입력해주세요");
    nameInput.focus(); // 해당 입력칸으로 커서 이동
    return;
  }

  if (customerPhone === "") {
    alert("전화번호를 입력해주세요");
    phoneInput.focus();
    return;
  }

  if (drinkSelect.value === "") {
    alert("음료를 선택해주세요");
    drinkSelect.focus();
    return;
  }

  // --- 검사를 모두 통과했으니 주문 확인 메시지를 만듭니다. ---

  // 음료 이름: 선택된 <option>의 글자는 "카페라떼 4,000원" 형태이므로
  // 정규식으로 뒤쪽의 가격 부분(" 4,000원")을 지워서 "카페라떼"만 남깁니다.
  const selectedDrink = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkName = selectedDrink.textContent.replace(/\s*[\d,]+원$/, "").trim();

  // 사이즈: 선택된 라디오의 value 값 (S / M / L)
  const size = document.querySelector('input[name="size"]:checked').value;

  // 추가 옵션 이름 모으기: 체크된 체크박스에 연결된 label 글자를 가져옵니다.
  // label 글자는 "샷 추가 (+500원)" 형태이므로 괄호 부분을 지워 "샷 추가"만 남깁니다.
  const optionNames = [];
  optionChecks.forEach(function (check) {
    if (check.checked) {
      const label = document.querySelector('label[for="' + check.id + '"]');
      optionNames.push(label.textContent.replace(/\s*\(.*\)\s*$/, "").trim());
    }
  });

  // 옵션이 하나라도 있으면 " (샷 추가, 크림 추가)" 처럼 괄호 문구를 만들고,
  // 없으면 빈 문자열("")로 두어 괄호 부분을 빼 줍니다.
  const optionText = optionNames.length > 0 ? " (" + optionNames.join(", ") + ")" : "";

  // 수량: 계산 함수와 같은 방식으로 1~100 범위로 보정합니다.
  let quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) quantity = 1;
  if (quantity > 100) quantity = 100;

  // 총 금액은 calculateTotal() 을 재사용합니다.
  const total = calculateTotal();

  // 최종 메시지 조립
  const message =
    customerName + "님, " +
    drinkName + " " + size + "사이즈" + optionText + " " +
    quantity + "잔, 총 " + total.toLocaleString() + "원 주문이 접수되었습니다!";

  // --- Supabase 에 주문 저장 ---
  const requestText = document.getElementById("request").value.trim(); // 요청사항
  const orderBtn = document.getElementById("order-btn");               // 주문하기 버튼

  // 저장하는 동안 버튼을 비활성화해서 두 번 눌리는 것을 막습니다.
  orderBtn.disabled = true;

  try {
    // SUPABASE_URL / SUPABASE_KEY 를 아직 안 넣었다면 저장할 수 없으니 에러로 처리합니다.
    if (!supabaseClient) {
      throw new Error("SUPABASE_URL 과 SUPABASE_KEY 를 script.js 맨 위에 입력해주세요.");
    }

    // orders 테이블에 1건 추가합니다. (열 이름은 테이블의 컬럼 이름과 같아야 합니다)
    const { error } = await supabaseClient.from("orders").insert({
      customer_name: customerName,                 // 이름
      phone: customerPhone,                        // 전화번호
      drink: drinkName,                            // 음료 이름
      drink_price: Number(selectedDrink.dataset.price), // 음료 기본 가격
      size: size,                                  // 사이즈
      options: optionNames,                        // 추가 옵션 (배열)
      quantity: quantity,                          // 수량
      request: requestText,                        // 요청사항
      total_price: total                           // 총 금액
    });

    // Supabase 는 실패해도 예외를 던지지 않고 error 에 담아 돌려줍니다.
    // 그래서 직접 던져서 아래 catch 로 보냅니다.
    if (error) {
      throw error;
    }
  } catch (err) {
    // 저장 실패: 알림 + 콘솔에 에러 출력 (개발자도구 F12 > Console 에서 확인)
    console.error("주문 저장 실패:", err);
    alert("주문 저장에 실패했어요");
    return; // 실패했으니 확인 메시지와 주문 내역 추가는 하지 않습니다.
  } finally {
    // 성공이든 실패든 버튼을 다시 누를 수 있게 되돌립니다.
    orderBtn.disabled = false;
  }

  // --- 저장 성공: 주문 확인 메시지 표시 ---
  // textContent 로 넣으면 이름에 특수문자가 있어도 안전하게 글자로만 표시됩니다.
  resultBox.textContent = message;
  resultBox.hidden = false; // 숨겨 둔 영역을 보이게 합니다.

  // --- 주문 내역에 저장 ---
  // 주문 1건의 정보를 객체로 묶어 orders 배열에 넣습니다.
  orders.push({
    id: nextOrderId,                    // 주문번호
    name: customerName,                 // 이름
    drink: drinkName,                   // 음료
    size: size,                         // 사이즈
    options: optionNames,               // 옵션 (배열)
    quantity: quantity,                 // 수량
    request: requestText,               // 요청사항
    price: total,                      // 금액
    time: new Date().toLocaleString("ko-KR") // 주문 시간 (예: 2026. 10. 8. 오후 3:20:00)
  });
  nextOrderId++;      // 다음 주문번호 준비
  renderOrders();     // 주문 내역 화면 갱신
});

// ------------------------------------------------------------
// 6. 다시 작성 (초기화)
//    reset 버튼은 브라우저가 입력값을 HTML에 적힌 기본값으로 되돌려 줍니다.
//    (사이즈 M 선택, 수량 1 등) 다만 "reset" 이벤트는 값이 되돌아가기 "직전"에
//    발생하므로, setTimeout(…, 0) 으로 한 박자 늦춰서 금액을 다시 계산합니다.
// ------------------------------------------------------------
form.addEventListener("reset", function () {
  resultBox.hidden = true;     // 주문 확인 메시지 숨기기
  resultBox.textContent = "";  // 메시지 내용도 비우기

  setTimeout(updateTotalPrice, 0); // 초기화가 끝난 뒤 "예상 금액: 0원"으로 갱신
});

// ------------------------------------------------------------
// 7. 탭 전환 (주문하기 / 주문 내역)
//    숨기기/보이기는 CSS의 .hidden 클래스를 붙였다 떼는 방식으로 합니다.
//    classList.toggle("hidden", true)  → hidden 클래스 붙임(숨김)
//    classList.toggle("hidden", false) → hidden 클래스 뺌(보임)
// ------------------------------------------------------------
const tabBtnOrder = document.getElementById("tab-btn-order");
const tabBtnHistory = document.getElementById("tab-btn-history");
const tabOrder = document.getElementById("tab-order");
const tabHistory = document.getElementById("tab-history");

function showTab(tabName) {
  const isOrderTab = tabName === "order";

  // 보여줄 화면은 hidden 제거, 나머지는 hidden 추가
  tabOrder.classList.toggle("hidden", !isOrderTab);
  tabHistory.classList.toggle("hidden", isOrderTab);

  // 선택된 탭 버튼에만 active 클래스 (갈색 글씨 + 밑줄)
  tabBtnOrder.classList.toggle("active", isOrderTab);
  tabBtnHistory.classList.toggle("active", !isOrderTab);
  tabBtnOrder.setAttribute("aria-selected", String(isOrderTab));
  tabBtnHistory.setAttribute("aria-selected", String(!isOrderTab));
}

tabBtnOrder.addEventListener("click", function () { showTab("order"); });
tabBtnHistory.addEventListener("click", function () { showTab("history"); });

// ------------------------------------------------------------
// 8. 주문 내역 데이터와 화면 그리기
// ------------------------------------------------------------
const orders = [];    // 접수된 주문들을 담는 배열 (오래된 주문이 앞, 최신이 뒤)
let nextOrderId = 1;  // 다음 주문번호 (#1, #2, ...)

const ordersList = document.getElementById("orders-list");       // 카드 목록 영역
const ordersEmpty = document.getElementById("orders-empty");     // "주문 내역 없음" 안내
const ordersFooter = document.getElementById("orders-footer");   // 합계 + 전체삭제 영역
const ordersSummary = document.getElementById("orders-summary"); // "총 주문 금액" 글자
const orderCount = document.getElementById("order-count");       // 탭 옆 배지
const clearOrdersBtn = document.getElementById("clear-orders-btn");

// 텍스트가 들어간 요소를 만드는 도우미 함수
// innerHTML 대신 textContent 를 쓰면 손님이 입력한 글자가 HTML 코드로 실행되지 않아 안전합니다.
function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// 주문 내역 목록을 처음부터 다시 그리는 함수 (주문이 바뀔 때마다 이 함수만 부르면 됩니다)
function renderOrders() {
  // (1) 기존 카드를 모두 지웁니다. (textContent = "" 는 안의 내용을 비웁니다)
  ordersList.textContent = "";

  // (2) 최신 주문이 맨 위에 오도록 복사본(slice)을 뒤집어(reverse) 사용합니다.
  //     원본 orders 배열의 순서는 건드리지 않습니다.
  orders.slice().reverse().forEach(function (order) {
    const card = createEl("div", "order-card");

    // 1줄: "#1 홍길동님 · 5,000원"
    card.appendChild(createEl("div", "order-line1",
      "#" + order.id + " " + order.name + "님 · " + order.price.toLocaleString() + "원"));

    // 2줄: "카페라떼 M사이즈 (샷 추가) 1잔" (옵션이 없으면 괄호 생략)
    const optionText = order.options.length > 0 ? " (" + order.options.join(", ") + ")" : "";
    card.appendChild(createEl("div", "order-line2",
      order.drink + " " + order.size + "사이즈" + optionText + " " + order.quantity + "잔"));

    // 3줄: 요청사항(있을 때만) · 주문 시간
    const line3 = order.request !== "" ? order.request + " · " + order.time : order.time;
    card.appendChild(createEl("div", "order-line3", line3));

    // 오른쪽 위 "취소" 버튼: confirm 으로 한 번 더 물어보고 삭제
    const cancelBtn = createEl("button", "cancel-btn", "취소");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", function () {
      if (confirm("#" + order.id + " 주문을 취소할까요?")) {
        const index = orders.indexOf(order); // 배열에서 이 주문의 위치 찾기
        orders.splice(index, 1);             // 그 위치의 주문 1개 삭제
        renderOrders();                      // 다시 그리기
      }
    });
    card.appendChild(cancelBtn);

    ordersList.appendChild(card);
  });

  // (3) 총 금액 계산: 모든 주문의 price 를 더합니다.
  let totalAmount = 0;
  orders.forEach(function (order) {
    totalAmount += order.price;
  });
  ordersSummary.textContent =
    "총 주문 금액: " + totalAmount.toLocaleString() + "원 (" + orders.length + "건)";

  // (4) 주문이 없으면 안내 문구, 있으면 합계/전체삭제 영역을 보여줍니다.
  const hasOrders = orders.length > 0;
  ordersEmpty.classList.toggle("hidden", hasOrders);
  ordersFooter.classList.toggle("hidden", !hasOrders);

  // (5) 탭 옆 배지의 숫자 갱신
  orderCount.textContent = orders.length;
}

// "내역 모두 지우기": confirm 으로 확인 후 배열을 비웁니다.
clearOrdersBtn.addEventListener("click", function () {
  if (confirm("주문 내역을 모두 지울까요?")) {
    orders.length = 0;  // 배열을 비움
    nextOrderId = 1;    // 주문번호도 처음부터
    renderOrders();
  }
});

// ------------------------------------------------------------
// 9. 페이지를 처음 열었을 때 금액과 주문 내역을 한 번 표시해 둡니다.
//    (다시 작성 버튼은 주문서만 초기화하고 orders 는 건드리지 않습니다.)
// ------------------------------------------------------------
updateTotalPrice();
renderOrders();
