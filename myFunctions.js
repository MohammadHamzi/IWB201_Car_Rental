/* ===== myFunctions.js : كل توابع الجافاسكريبت و jQuery للموقع ===== */

var DISCOUNT_DAYS = 10;      // الخصم عند تجاوز هذا العدد من الأيام
var DISCOUNT_RATE = 0.05;    // نسبة الخصم 5%

// السيارات المختارة (مصفوفات متوازية)
var selCodes = new Array();
var selModels = new Array();
var selPrices = new Array();

// بيانات الطلب بعد نجاح التحقق
var rentName = "";
var rentStart = null;
var rentEnd = null;
var firstBad = "";

/* ---------- توابع مساعدة ---------- */

// حذف الفراغات من بداية النص ونهايته
function trimText(s) {
  var start = 0;
  var end = s.length;
  while (start < end && s.charAt(start) == " ") {
    start++;
  }
  while (end > start && s.charAt(end - 1) == " ") {
    end--;
  }
  return s.substring(start, end);
}

// كتابة مبلغ مع فواصل الآلاف
function formatMoney(value) {
  var s = String(Math.round(value));
  var out = "";
  var count = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    out = s.charAt(i) + out;
    count++;
    if (count % 3 == 0 && i > 0) {
      out = "," + out;
    }
  }
  return out + " ل.س";
}

/* ---------- توابع التحقق ---------- */

// الاسم: أحرف هجائية عربية فقط، كلمتان على الأقل
function isValidArabicName(name) {
  return name.search(/^[\u0621-\u064A]+( +[\u0621-\u064A]+)+$/) == 0;
}

// الرقم الوطني: 11 خانة وأول خانتين (المحافظة) من 01 إلى 14
function isValidNationalId(id) {
  if (id.search(/^\d{11}$/) != 0) {
    return false;
  }
  var province = parseInt(id.substring(0, 2), 10);
  return province >= 1 && province <= 14;
}

// تاريخ بصيغة yyyy-mm-dd: يعيد كائن Date أو null إذا كان غير صالح
function makeDate(text) {
  if (text.search(/^\d{4}-\d{2}-\d{2}$/) != 0) {
    return null;
  }
  var y = parseInt(text.substring(0, 4), 10);
  var m = parseInt(text.substring(5, 7), 10);
  var d = parseInt(text.substring(8, 10), 10);
  var date = new Date(y, m - 1, d);
  if (date.getFullYear() != y || date.getMonth() != m - 1 || date.getDate() != d) {
    return null;
  }
  return date;
}

// رسالة خطأ التاريخ: "" إذا كان صحيحاً
function dateProblem(text) {
  if (text.search(/^\d{4}-\d{2}-\d{2}$/) != 0) {
    return "الصيغة المطلوبة <span dir=\"ltr\">yyyy-mm-dd</span> بيوم وشهر من رقمين، مثال: <span dir=\"ltr\">2026-12-02</span>";
  }
  if (makeDate(text) == null) {
    return "هذا التاريخ غير موجود في التقويم.";
  }
  return "";
}

// الموبايل: يعيد اسم الشبكة أو "" إذا لم يطابق Syriatel أو MTN
function getOperator(mobile) {
  if (mobile.search(/^09\d{8}$/) != 0) {
    return "";
  }
  var prefix = mobile.substring(0, 3);
  switch (prefix) {
    case "093":
    case "098":
    case "099":
      return "Syriatel";
    case "094":
    case "095":
    case "096":
      return "MTN";
    default:
      return "";
  }
}

function isValidEmail(email) {
  return email.search(/^[A-Za-z0-9._\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/) == 0;
}

/* ---------- الحساب ---------- */

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

// يعيد مصفوفة: [المجموع, الخصم, المبلغ النهائي]
function calcTotals(days) {
  var total = 0;
  for (var i = 0; i < selPrices.length; i++) {
    total = total + selPrices[i] * days;
  }
  var discount = 0;
  if (days > DISCOUNT_DAYS) {
    discount = total * DISCOUNT_RATE;
  }
  return [total, discount, total - discount];
}

/* ---------- التعامل مع الصفحة ---------- */

// قراءة السيارات المختارة من الجدول، وإرجاع عددها
function readSelectedCars() {
  var boxes = document.getElementsByName("selectCar");
  selCodes = new Array();
  selModels = new Array();
  selPrices = new Array();
  for (var i = 0; i < boxes.length; i++) {
    if (boxes[i].checked) {
      var n = boxes[i].value;
      var k = selModels.length;
      selCodes[k] = document.getElementById("code" + n).innerHTML;
      selModels[k] = document.getElementById("model" + n).innerHTML;
      selPrices[k] = parseInt(document.getElementById("price" + n).innerHTML, 10);
    }
  }
  return selModels.length;
}

function refreshSummary() {
  var html = "";
  for (var i = 0; i < selModels.length; i++) {
    if (i > 0) {
      html = html + "<br />";
    }
    html = html + "<span dir=\"ltr\">" + selModels[i] + " (" + selCodes[i] + ")</span>";
  }
  $("#selectedSummary").html(html);
}

function showError(id, message) {
  $("#" + id).addClass("invalid");
  $("#err-" + id).html(message);   // الرسائل ثابتة من عندنا (فيها وسم span لاتجاه التاريخ)
  if (firstBad == "") {
    firstBad = id;
  }
}

function clearErrors() {
  $("#reservationForm input").removeClass("invalid");
  $("#reservationForm span.error").text("");
  firstBad = "";
}

// التحقق من كل الحقول: يعيد true إذا كانت كلها صحيحة
function validateForm() {
  clearErrors();
  var name = trimText($("#fullName").val());
  var nid = trimText($("#nationalId").val());
  var startText = trimText($("#startDate").val());
  var endText = trimText($("#endDate").val());
  var mobile = trimText($("#mobile").val());
  var email = trimText($("#email").val());
  var start = null;
  var end = null;

  // الاسم (اختياري، لكن يجب أن يكون صحيحاً إذا أُدخل)
  if (name != "" && !isValidArabicName(name)) {
    showError("fullName", "اكتب الاسم الكامل بأحرف عربية فقط (كلمتان على الأقل).");
  }

  // الرقم الوطني (إلزامي)
  if (nid == "") {
    showError("nationalId", "الرقم الوطني مطلوب.");
  } else if (!isValidNationalId(nid)) {
    showError("nationalId", "الرقم الوطني من 11 رقماً، وأول رقمين بين 01 و 14.");
  }

  // تاريخ البداية (إلزامي)
  if (startText == "") {
    showError("startDate", "تاريخ البداية مطلوب.");
  } else {
    start = makeDate(startText);
    if (start == null) {
      showError("startDate", dateProblem(startText));
    }
  }

  // تاريخ النهاية (إلزامي)
  if (endText == "") {
    showError("endDate", "تاريخ النهاية مطلوب.");
  } else {
    end = makeDate(endText);
    if (end == null) {
      showError("endDate", dateProblem(endText));
    }
  }

  // التسلسل الزمني
  if (start != null && end != null && end.getTime() <= start.getTime()) {
    showError("endDate", "تاريخ النهاية يجب أن يكون لاحقاً لتاريخ البداية.");
  }

  // الموبايل (اختياري)
  if (mobile != "" && getOperator(mobile) == "") {
    showError("mobile", "الرقم لا يطابق Syriatel (093 / 098 / 099) ولا MTN (094 / 095 / 096).");
  }

  // البريد (اختياري)
  if (email != "" && !isValidEmail(email)) {
    showError("email", "صيغة البريد الإلكتروني غير صحيحة.");
  }

  if (firstBad != "") {
    document.getElementById(firstBad).focus();
    return false;
  }
  rentName = name;
  rentStart = start;
  rentEnd = end;
  return true;
}

// نافذة النتيجة: الأيام والمجموع والخصم والمبلغ النهائي
function showResult() {
  var days = daysBetween(rentStart, rentEnd);
  var t = calcTotals(days);
  var html = "<h2>ملخص طلب الحجز</h2>";
  if (rentName != "") {
    html = html + "<p>مقدم الطلب: <b>" + rentName + "</b></p>";
  }
  html = html + "<p>من <span dir=\"ltr\">" + trimText($("#startDate").val()) + "</span> إلى <span dir=\"ltr\">" +
         trimText($("#endDate").val()) + "</span> (عدد أيام التأجير: " + days + ")</p>";
  html = html + "<table cellspacing=\"0\" cellpadding=\"6\">";
  html = html + "<tr><th>السيارة</th><th>السعر اليومي</th><th>الأيام</th><th>الإجمالي</th></tr>";
  for (var i = 0; i < selModels.length; i++) {
    html = html + "<tr><td>" + selModels[i] + "</td><td>" + formatMoney(selPrices[i]) +
           "</td><td>" + days + "</td><td>" + formatMoney(selPrices[i] * days) + "</td></tr>";
  }
  html = html + "<tr class=\"total\"><td colspan=\"3\">المجموع</td><td>" + formatMoney(t[0]) + "</td></tr>";
  if (t[1] > 0) {
    html = html + "<tr class=\"total\"><td colspan=\"3\">الخصم 5% (المدة أكثر من 10 أيام)</td><td>" + formatMoney(t[1]) + "</td></tr>";
  } else {
    html = html + "<tr class=\"total\"><td colspan=\"3\">الخصم (لا ينطبق)</td><td>" + formatMoney(0) + "</td></tr>";
  }
  html = html + "<tr class=\"total\"><td colspan=\"3\">المبلغ النهائي</td><td>" + formatMoney(t[2]) + "</td></tr>";
  html = html + "</table>";
  $("#resultBody").html(html);
  $("#resultBox").css("display", "block");
}

/* ---------- ربط الأحداث (jQuery) ---------- */
$(document).ready(function () {

  // زر الخروج في شريط التنقل (كل الصفحات): إذا ضغط "موافق" ينتقل إلى صفحة فارغة
  $("a.exit-link").click(function () {
    if (confirm("هل تريد الخروج من الموقع؟")) {
      return true;
    }
    return false;
  });

  // صفحة من نحن: تمييز صف الفرع عند النقر
  $("tr.branch-row").click(function () {
    $(this).toggleClass("selected-row");
  });

  // صفحة السيارات: إظهار/إخفاء التفاصيل (عدة سيارات معاً)
  $("input.show-details").click(function () {
    $("#" + $(this).val()).toggleClass("hidden");
  });

  // زر المتابعة: إظهار نموذج الحجز في نفس الصفحة
  $("#continueBtn").click(function () {
    if (readSelectedCars() == 0) {
      $("#selectMsg").text("اختر سيارة واحدة على الأقل قبل المتابعة.");
      return false;
    }
    $("#selectMsg").text("");
    refreshSummary();
    $("#reservation").css("display", "block");
    document.getElementById("fullName").focus();
  });

  // تحديث ملخص السيارات إذا تغيّر الاختيار بعد ظهور النموذج
  $("input.select-car").click(function () {
    if ($("#reservation").css("display") == "block") {
      if (readSelectedCars() == 0) {
        $("#reservation").css("display", "none");
      } else {
        refreshSummary();
      }
    }
  });

  // إلغاء الطلب
  $("#cancelBtn").click(function () {
    clearErrors();
    $("#reservation").css("display", "none");
  });

  // إرسال النموذج
  $("#reservationForm").submit(function () {
    readSelectedCars();
    if (validateForm()) {
      showResult();
    }
    return false;
  });

  // إغلاق نافذة النتيجة
  $("#closeResult").click(function () {
    $("#resultBox").css("display", "none");
  });
});
