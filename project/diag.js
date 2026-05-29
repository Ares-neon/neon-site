/* ============================================================
   NEON — Diagnóstico form
   ============================================================ */
(function () {
  "use strict";

  const form = document.getElementById("diag-form");
  if (!form) return;
  const card = document.getElementById("form-card");

  /* ============================================================
     CONFIGURAÇÃO — DESTINO DOS LEADS
     ------------------------------------------------------------
     1) WhatsApp (já funciona): troque pelo número real no formato
        DDI + DDD + número, só dígitos. Ex.: 55 11 99999-9999 -> "5511999999999"
     2) E-mail automático (opcional, sem servidor): crie uma conta
        gratuita em formspree.io ou web3forms.com, cole a URL/endpoint
        abaixo e os dados chegam no seu e-mail a cada envio.
     ============================================================ */
  const WHATSAPP_NUMBER = "5511999999999";
  const LEAD_ENDPOINT = ""; // ex.: "https://formspree.io/f/seuid"

  const fields = {
    nome: { el: form.nome, validate: (v) => v.trim().length >= 2, msg: "Informe seu nome completo." },
    celular: {
      el: form.celular,
      validate: (v) => v.replace(/\D/g, "").length >= 10,
      msg: "Informe um celular válido com DDD.",
    },
    email: {
      el: form.email,
      validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
      msg: "Informe um e-mail válido.",
    },
    instagram: {
      el: form.instagram,
      validate: (v) => v.replace(/[@\s]/g, "").length >= 2,
      msg: "Informe o @ da sua marca.",
    },
  };

  /* phone mask: (00) 00000-0000 */
  const phone = fields.celular.el;
  phone.addEventListener("input", () => {
    let d = phone.value.replace(/\D/g, "").slice(0, 11);
    let out = "";
    if (d.length > 0) out = "(" + d.slice(0, 2);
    if (d.length >= 2) out += ") ";
    if (d.length > 2) out += d.slice(2, d.length > 10 ? 7 : 6);
    if (d.length > (d.length > 10 ? 7 : 6)) out += "-" + d.slice(d.length > 10 ? 7 : 6, 11);
    phone.value = out;
  });

  /* instagram: keep a leading @ */
  const ig = fields.instagram.el;
  ig.addEventListener("input", () => {
    let v = ig.value.replace(/\s/g, "");
    v = "@" + v.replace(/@/g, "");
    if (v === "@") v = "";
    ig.value = v;
  });

  function setError(key, on) {
    const wrap = fields[key].el.closest(".field");
    wrap.classList.toggle("has-error", on);
  }

  Object.keys(fields).forEach((key) => {
    fields[key].el.addEventListener("input", () => {
      if (fields[key].el.closest(".field").classList.contains("has-error")) {
        setError(key, !fields[key].validate(fields[key].el.value));
      }
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    let firstBad = null;
    Object.keys(fields).forEach((key) => {
      const valid = fields[key].validate(fields[key].el.value);
      setError(key, !valid);
      if (!valid && ok) { ok = false; firstBad = fields[key].el; }
    });
    if (!ok) { if (firstBad) firstBad.focus(); return; }

    const data = {
      nome: fields.nome.el.value.trim(),
      celular: fields.celular.el.value.trim(),
      email: fields.email.el.value.trim(),
      instagram: fields.instagram.el.value.trim(),
    };

    // 1) Envio automático para um backend sem servidor (opcional)
    if (LEAD_ENDPOINT) {
      fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      }).catch(() => {});
    }

    // 2) CTA final — abrir WhatsApp com a mensagem já preenchida
    const text =
      "Olá, NEON! Quero agendar meu diagnóstico gratuito.\n\n" +
      "Nome: " + data.nome + "\n" +
      "Celular: " + data.celular + "\n" +
      "E-mail: " + data.email + "\n" +
      "Instagram: " + data.instagram;
    const wa = document.getElementById("wa-cta");
    if (wa) wa.href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);

    // fill summary + show success
    const set = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = val; };
    set("sum-nome", data.nome);
    set("sum-celular", data.celular);
    set("sum-email", data.email);
    set("sum-instagram", data.instagram);
    card.classList.add("is-done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
