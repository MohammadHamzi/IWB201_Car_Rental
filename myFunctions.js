/* ===== myFunctions.js : كل توابع الجافاسكريبت و jQuery للموقع ===== */

var DISCOUNT_THRESHOLD_DAYS = 10;   // الخصم يُطبّق إذا تجاوزت المدة هذا العدد
var DISCOUNT_RATE = 0.05;           // خصم 5%
var MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ---------- توابع مساعدة ---------- */

// تحويل الأرقام العربية الهندية (٠١٢...) إلى أرقام لاتينية
function toWesternDigits(text) {
  var result = "";
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code >= 0x0660 && code <= 0x0669) {
      result += String(code - 0x0660);
    } else {
      result += text.charAt(i);
    }
  }
  return result;
}

function formatMoney(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " ل.س";
}

/* ---------- توابع التحقق ---------- */

// الاسم: أحرف هجائية عربية فقط (كلمتان على الأقل) مفصولة بمسافات
function isValidArabicName(name) {
  return /^[\u0621-\u064A]+(\s+[\u0621-\u064A]+)+$/.test(name);
}

// الرقم الوطني: 11 خانة، أول خانتين (المحافظة) بين 01 و 14
function isValidNationalId(id) {
  if (!/^\d{11}$/.test(id)) {
    return false;
  }
  var province = parseInt(id.substring(0, 2), 10);
  return province >= 1 && province <= 14;
}

// تاريخ بصيغة yyyy-mm-dd: يعيد كائن Date أو null إن كان غير صالح (يشمل التحقق من 30 شباط مثلاً)
function parseDate(text) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m === null) {
    return null;
  }
  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d = parseInt(m[3], 10);
  var date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

// الموبايل: يعيد اسم الشبكة ("Syriatel" أو "MTN") أو null إن لم يطابق أياً منهما
function getMobileOperator(raw) {
  var num = raw.replace(/[\s\-]/g, "");
  if (num.indexOf("+963") === 0) {
    num = "0" + num.substring(4);
  } else if (num.indexOf("00963") === 0) {
    num = "0" + num.substring(5);
  }
  if (!/^09\d{8}$/.test(num)) {
    return null;
  }
  var prefix = num.substring(0, 3);
  var syriatel = ["093", "098", "099"];
  var mtn = ["094", "095", "096"];
  if (syriatel.indexOf(prefix) !== -1) {
    return "Syriatel";
  }
  if (mtn.indexOf(prefix) !== -1) {
    return "MTN";
  }
  return null;
}

function isValidEmail(email) {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/.test(email);
}

/* ---------- الحساب ---------- */

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

// cars: مصفوفة {model, price}  —  يعيد تفاصيل كل سيارة والمجموع والخصم والصافي
function calculateTotals(cars, days) {
  var rows = [];
  var total = 0;
  for (var i = 0; i < cars.length; i++) {
    var subtotal = cars[i].price * days;
    rows.push({ model: cars[i].model, price: cars[i].price, days: days, subtotal: subtotal });
    total += subtotal;
  }
  var discount = 0;
  if (days > DISCOUNT_THRESHOLD_DAYS) {
    discount = total * DISCOUNT_RATE;
  }
  return { rows: rows, total: total, discount: discount, finalAmount: total - discount };
}

/* ---------- تفاعل الصفحات (jQuery) ---------- */

// قراءة السيارات المختارة من الجدول
function getSelectedCars() {
  var cars = [];
  $("input.select-car:checked").each(function () {
    var $row = $(this).closest("tr");
    cars.push({
      code: $(this).val(),
      model: $.trim($row.find("td.model").text()),
      price: parseInt($row.find("td.price").text().replace(/\D/g, ""), 10)
    });
  });
  return cars;
}

function refreshSelectedSummary() {
  var cars = getSelectedCars();
  var names = [];
  for (var i = 0; i < cars.length; i++) {
    names.push(cars[i].model + " (" + cars[i].code + ")");
  }
  $("#selectedSummary").text(names.length > 0 ? names.join("، ") : "لا توجد سيارات مختارة");
}

function setFieldError(fieldId, message) {
  $("#" + fieldId).addClass("invalid");
  $("#err-" + fieldId).text(message);
}

function clearErrors() {
  $("#reservationForm input").removeClass("invalid");
  $("#reservationForm span.error").text("");
}

// التحقق من كل الحقول؛ يعيد {ok, firstInvalid, values}
function validateReservationForm() {
  clearErrors();
  var invalidIds = [];
  var name = $.trim($("#fullName").val());
  var nid = toWesternDigits($.trim($("#nationalId").val()));
  var startText = toWesternDigits($.trim($("#startDate").val()));
  var endText = toWesternDigits($.trim($("#endDate").val()));
  var mobile = toWesternDigits($.trim($("#mobile").val()));
  var email = $.trim($("#email").val());

  // الاسم (اختياري، لكن إن أُدخل يجب أن يكون صحيحاً)
  if (name !== "" && !isValidArabicName(name)) {
    setFieldError("fullName", "اكتب الاسم الكامل بأحرف عربية فقط (كلمتان على الأقل).");
    invalidIds.push("fullName");
  }

  // الرقم الوطني (إلزامي)
  if (nid === "") {
    setFieldError("nationalId", "الرقم الوطني مطلوب.");
    invalidIds.push("nationalId");
  } else if (!isValidNationalId(nid)) {
    setFieldError("nationalId", "الرقم الوطني من 11 رقماً، وأول رقمين بين 01 و 14.");
    invalidIds.push("nationalId");
  }

  // التواريخ (إلزامية)
  var start = null;
  var end = null;
  if (startText === "") {
    setFieldError("startDate", "تاريخ البداية مطلوب.");
    invalidIds.push("startDate");
  } else {
    start = parseDate(startText);
    if (start === null) {
      setFieldError("startDate", "استخدم الصيغة yyyy-mm-dd وتاريخاً حقيقياً.");
      invalidIds.push("startDate");
    }
  }
  if (endText === "") {
    setFieldError("endDate", "تاريخ النهاية مطلوب.");
    invalidIds.push("endDate");
  } else {
    end = parseDate(endText);
    if (end === null) {
      setFieldError("endDate", "استخدم الصيغة yyyy-mm-dd وتاريخاً حقيقياً.");
      invalidIds.push("endDate");
    }
  }
  if (start !== null && end !== null && end.getTime() <= start.getTime()) {
    setFieldError("endDate", "تاريخ النهاية يجب أن يكون لاحقاً لتاريخ البداية.");
    invalidIds.push("endDate");
  }

  // الموبايل (اختياري)
  if (mobile !== "" && getMobileOperator(mobile) === null) {
    setFieldError("mobile", "رقم غير مطابق لشبكتي Syriatel (093/098/099) أو MTN (094/095/096).");
    invalidIds.push("mobile");
  }

  // البريد (اختياري)
  if (email !== "" && !isValidEmail(email)) {
    setFieldError("email", "صيغة البريد الإلكتروني غير صحيحة.");
    invalidIds.push("email");
  }

  return {
    ok: invalidIds.length === 0,
    firstInvalid: invalidIds[0],
    values: { name: name, start: start, end: end }
  };
}

function showResultWindow(name, start, end) {
  var cars = getSelectedCars();
  var days = daysBetween(start, end);
  var t = calculateTotals(cars, days);

  var html = "<h2>ملخص طلب الحجز</h2>";
  if (name !== "") {
    html += "<p>مقدم الطلب: <strong id=\"resName\"></strong></p>";
  }
  html += "<p>من " + $("#startDate").val() + " إلى " + $("#endDate").val() + "</p>";
  html += "<table><tr><th>السيارة</th><th>السعر اليومي</th><th>أيام التأجير</th><th>الإجمالي</th></tr>";
  for (var i = 0; i < t.rows.length; i++) {
    html += "<tr><td></td><td>" + formatMoney(t.rows[i].price) + "</td><td>" + t.rows[i].days +
            "</td><td>" + formatMoney(t.rows[i].subtotal) + "</td></tr>";
  }
  html += "<tr class=\"total-line\"><td colspan=\"3\">المجموع</td><td>" + formatMoney(t.total) + "</td></tr>";
  html += "<tr class=\"total-line\"><td colspan=\"3\">الخصم" +
          (t.discount > 0 ? " (5% لأن المدة تتجاوز 10 أيام)" : " (لا ينطبق)") +
          "</td><td>" + formatMoney(t.discount) + "</td></tr>";
  html += "<tr class=\"total-line\"><td colspan=\"3\">المبلغ النهائي</td><td>" + formatMoney(t.finalAmount) + "</td></tr>";
  html += "</table>";

  $("#resultBody").html(html);
  // إدراج النصوص عبر text() لتجنب أي حقن
  if (name !== "") {
    $("#resName").text(name);
  }
  $("#resultBody table tr").slice(1, 1 + t.rows.length).each(function (index) {
    $(this).find("td").eq(0).text(t.rows[index].model);
  });
  $("#resultOverlay").fadeIn(250);
}

/* ---------- التهيئة عند تحميل أي صفحة ---------- */
$(document).ready(function () {

  // تأثير ظهور المحتوى في كل صفحات الموقع
  $("#content").hide().fadeIn(300);

  // زر الخروج في شريط التنقل
  $("a.exit-link").click(function (e) {
    e.preventDefault();
    if (window.confirm("هل تريد الخروج من الموقع؟")) {
      window.close();                       // يعمل فقط إذا فُتحت النافذة برمجياً
      window.location.href = "about:blank"; // بديل عند منع إغلاق النافذة
    }
  });

  // صفحة من نحن: تمييز صف الفرع عند النقر
  $("table.branches tbody tr").click(function () {
    $(this).toggleClass("hover-row");
  });

  /* ---- صفحة السيارات ---- */
  if ($("#carsTable").length === 0) {
    return;
  }

  // إظهار/إخفاء التفاصيل عند الضغط على المربع (عدة سيارات معاً)
  $("input.show-details").click(function () {
    var $detailsRow = $(this).closest("tr").next("tr.details-row");
    if (this.checked) {
      $detailsRow.show().find("div.details-box").slideDown(300);
    } else {
      $detailsRow.find("div.details-box").slideUp(300, function () {
        $(this).closest("tr").hide();
      });
    }
  });

  // زر المتابعة
  $("#continueBtn").click(function () {
    var cars = getSelectedCars();
    if (cars.length === 0) {
      $("#selectMsg").text("اختر سيارة واحدة على الأقل قبل المتابعة.");
      return;
    }
    $("#selectMsg").text("");
    refreshSelectedSummary();
    $("#reservation").slideDown(400, function () {
      $("#fullName").focus();
    });
  });

  // تحديث ملخص السيارات إذا تغيّر الاختيار بعد ظهور النموذج
  $("input.select-car").click(function () {
    if ($("#reservation").is(":visible")) {
      if (getSelectedCars().length === 0) {
        $("#reservation").slideUp(300);
      } else {
        refreshSelectedSummary();
      }
    }
  });

  // إلغاء النموذج
  $("#cancelBtn").click(function () {
    clearErrors();
    $("#reservation").slideUp(300);
  });

  // إرسال النموذج
  $("#reservationForm").submit(function (e) {
    e.preventDefault();
    var result = validateReservationForm();
    if (!result.ok) {
      $("#" + result.firstInvalid).focus();
      return;
    }
    showResultWindow(result.values.name, result.values.start, result.values.end);
  });

  $("#closeResult").click(function () {
    $("#resultOverlay").fadeOut(200);
  });
});

/* للاختبار خارج المتصفح فقط */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isValidArabicName: isValidArabicName, isValidNationalId: isValidNationalId,
    parseDate: parseDate, getMobileOperator: getMobileOperator, isValidEmail: isValidEmail,
    daysBetween: daysBetween, calculateTotals: calculateTotals, toWesternDigits: toWesternDigits
  };
}
