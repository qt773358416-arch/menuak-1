
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "products" | "categories" | "branches" | "orders" | "reports";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("products");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editing, setEditing] = useState<any>(null);

  async function verify(u: any) {
    setUser(u);

    if (!u) {
      setAuthorized(false);
      setChecking(false);
      return;
    }

    const { data, error } = await supabase
      .from("store_admins")
      .select("user_id")
      .eq("user_id", u.id)
      .maybeSingle();

    setAuthorized(!error && !!data);

    if (error) {
      setNotice("تعذر التحقق من صلاحية المدير: " + error.message);
    } else if (!data) {
      setNotice("هذا الحساب غير مضاف في جدول المديرين.");
    }

    setChecking(false);
  }

  async function loadData() {
    const [p, c, b, o] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("branches").select("*"),
      supabase.from("haleha_orders").select("*")
        .order("created_at", { ascending: false }),
    ]);

    setProducts(p.data || []);
    setCategories(c.data || []);
    setBranches(b.data || []);
    setOrders(o.data || []);

    const errors = [p.error, c.error, b.error, o.error].filter(Boolean);

    if (errors.length) {
      setNotice(
        "تعذر تحميل بعض البيانات. تحقق من صلاحيات الجداول: " +
        errors.map((e: any) => e.message).join(" | ")
      );
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      verify(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => verify(session?.user || null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authorized) loadData();
  }, [authorized]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setNotice("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setNotice("تعذر تسجيل الدخول: " + error.message);
      setChecking(false);
      return;
    }

    await verify(data.user);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || price === "" || Number(price) < 0) {
      setNotice("أدخل اسم الصنف والسعر الصحيح.");
      return;
    }

    const payload = {
      name: name.trim(),
      price: Number(price),
      category,
      description,
      image_url: imageUrl,
    };

    const result = editing
      ? await supabase.from("products")
          .update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    if (result.error) {
      setNotice("تعذر حفظ الصنف: " + result.error.message);
      return;
    }

    setNotice("تم حفظ الصنف.");
    clearForm();
    await loadData();
  }

  function editProduct(p: any) {
    setEditing(p);
    setName(p.name || "");
    setPrice(String(p.price ?? ""));
    setCategory(p.category || "");
    setDescription(p.description || "");
    setImageUrl(p.image_url || "");
    setTab("products");
  }

  function clearForm() {
    setEditing(null);
    setName("");
    setPrice("");
    setCategory("");
    setDescription("");
    setImageUrl("");
  }

  async function deleteProduct(p: any) {
    if (!confirm("هل تريد حذف الصنف " + p.name + "؟")) return;

    const { error } = await supabase
      .from("products").delete().eq("id", p.id);

    setNotice(error ? error.message : "تم حذف الصنف.");
    if (!error) await loadData();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase
      .from("categories").insert({ name: newCategory.trim() });

    if (error) {
      setNotice("تعذر إضافة التصنيف: " + error.message);
      return;
    }

    setNewCategory("");
    setNotice("تمت إضافة التصنيف.");
    await loadData();
  }

  async function updateBranch(index: number, key: string, value: string) {
    setBranches(old => old.map((b, i) =>
      i === index ? { ...b, [key]: value } : b
    ));
  }

  async function saveBranches() {
    for (const b of branches) {
      const key = b.id !== undefined ? "id" : "name";
      const value = b.id !== undefined ? b.id : b.name;
      const { id, ...fields } = b;

      const { error } = await supabase
        .from("branches").update(fields).eq(key, value);

      if (error) {
        setNotice("تعذر حفظ الفرع: " + error.message);
        return;
      }
    }

    setNotice("تم حفظ الفروع.");
    await loadData();
  }

  async function updateOrder(o: any, status: string) {
    const changes: any = { status };

    if (status === "completed") {
      changes.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("haleha_orders").update(changes).eq("id", o.id);

    setNotice(error ? error.message : "تم تحديث حالة الطلب.");
    if (!error) await loadData();
  }

  const completed = orders.filter(o => o.status === "completed");
  const sales = completed.reduce(
    (sum, o) => sum + Number(o.total || 0), 0
  );

  if (checking) {
    return <main dir="rtl" className="p-8 text-center">
      جارٍ التحقق من تسجيل الدخول…
    </main>;
  }

  if (!user || !authorized) {
    return (
      <main dir="rtl" className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 border">
          <h1 className="text-2xl font-black text-pink-600">
            حليها ♡ — لوحة التحكم
          </h1>
          <label className="block">البريد الإلكتروني
            <input type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded-xl p-3 w-full mt-1" />
          </label>
          <label className="block">كلمة المرور
            <input type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="border rounded-xl p-3 w-full mt-1" />
          </label>
          {notice && <p className="text-red-600 text-sm">{notice}</p>}
          <button className="bg-pink-600 text-white rounded-xl p-3 w-full font-bold">
            تسجيل الدخول
          </button>
        </form>
      </main>
    );
  }

  const nav: [Tab, string][] = [
    ["products", "الأصناف"],
    ["categories", "التصنيفات"],
    ["branches", "الفروع"],
    ["orders", "الطلبات"],
    ["reports", "المبيعات"],
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-pink-50 text-gray-800">
      <header className="bg-white border-b p-5 flex justify-between items-center">
        <h1 className="text-2xl font-black text-pink-600">حليها ♡</h1>
        <button onClick={() => supabase.auth.signOut()}
          className="border rounded-lg px-3 py-2">تسجيل الخروج</button>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <nav className="flex gap-2 overflow-x-auto mb-5">
          {nav.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={"rounded-xl px-4 py-3 font-bold whitespace-nowrap " +
              (tab === id ? "bg-pink-600 text-white" : "bg-white border")}>
              {label}
            </button>
          ))}
        </nav>

        {notice && <p className="bg-white border rounded-xl p-3 mb-4 break-words">{notice}</p>}

        {tab === "products" && <>
          <form onSubmit={saveProduct} className="bg-white border rounded-2xl p-4 grid md:grid-cols-2 gap-3 mb-5">
            <h2 className="font-black text-xl md:col-span-2">
              {editing ? "تعديل صنف" : "إضافة صنف"}
            </h2>
            <input required placeholder="اسم الصنف" value={name}
              onChange={e => setName(e.target.value)} className="border rounded-lg p-3" />
            <input required type="number" min="0" step="0.01" placeholder="السعر بالريال"
              value={price} onChange={e => setPrice(e.target.value)} className="border rounded-lg p-3" />
            <input placeholder="التصنيف" list="haleha-categories" value={category}
              onChange={e => setCategory(e.target.value)} className="border rounded-lg p-3" />
            <datalist id="haleha-categories">
              {categories.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
            <input placeholder="رابط الصورة" value={imageUrl}
              onChange={e => setImageUrl(e.target.value)} className="border rounded-lg p-3" />
            <textarea placeholder="وصف الصنف" value={description}
              onChange={e => setDescription(e.target.value)}
              className="border rounded-lg p-3 md:col-span-2" />
            <button className="bg-pink-600 text-white rounded-xl p-3 font-bold">حفظ الصنف</button>
            <button type="button" onClick={clearForm} className="border rounded-xl p-3">صنف جديد</button>
          </form>

          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pink-100"><tr>
                <th className="p-3 text-right">الصنف</th>
                <th className="p-3 text-right">التصنيف</th>
                <th className="p-3 text-right">السعر</th>
                <th className="p-3">الإجراءات</th>
              </tr></thead>
              <tbody>{products.map(p => <tr key={p.id} className="border-t">
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.category || p.category_id || "—"}</td>
                <td className="p-3">{p.price} ر.س</td>
                <td className="p-3 whitespace-nowrap">
                  <button onClick={() => editProduct(p)} className="text-pink-700 ml-3">تعديل</button>
                  <button onClick={() => deleteProduct(p)} className="text-red-600">حذف</button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}

        {tab === "categories" && <>
          <form onSubmit={addCategory} className="bg-white border rounded-2xl p-4 flex gap-2 mb-4">
            <input required placeholder="اسم التصنيف الجديد" value={newCategory}
              onChange={e => setNewCategory(e.target.value)} className="border rounded-lg p-3 flex-1 min-w-0" />
            <button className="bg-pink-600 text-white rounded-lg px-4">إضافة</button>
          </form>
          <div className="bg-white border rounded-2xl divide-y">
            {categories.map(c => <div key={c.id} className="p-4">{c.name}</div>)}
          </div>
        </>}

        {tab === "branches" && <>
          <div className="bg-white border rounded-2xl p-4 space-y-4">
            {branches.map((b, i) => <div key={b.id || i} className="grid md:grid-cols-2 gap-3 border-b pb-4">
              <label>اسم الفرع
                <input value={b.name || ""} onChange={e => updateBranch(i, "name", e.target.value)}
                  className="border rounded-lg p-3 w-full mt-1" />
              </label>
              <label>رقم واتساب
                <input value={b.phone || b.whatsapp || ""}
                  onChange={e => updateBranch(i, b.phone !== undefined ? "phone" : "whatsapp", e.target.value)}
                  className="border rounded-lg p-3 w-full mt-1" />
              </label>
            </div>)}
            <button onClick={saveBranches} className="bg-pink-600 text-white rounded-xl p-3 font-bold">حفظ الفروع</button>
          </div>
        </>}

        {tab === "orders" && <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm"><thead className="bg-pink-100"><tr>
            <th className="p-3 text-right">رقم الطلب</th><th className="p-3 text-right">التاريخ</th>
            <th className="p-3 text-right">الفرع</th><th className="p-3 text-right">الإجمالي</th><th className="p-3">الحالة</th>
          </tr></thead><tbody>{orders.map(o => <tr key={o.id} className="border-t">
            <td className="p-3">{o.order_number || o.id}</td>
            <td className="p-3">{o.created_at ? new Date(o.created_at).toLocaleString("ar-SA") : "—"}</td>
            <td className="p-3">{o.branch_name}</td><td className="p-3">{o.total} ر.س</td>
            <td className="p-3"><select value={o.status || "new"} onChange={e => updateOrder(o, e.target.value)} className="border rounded-lg p-2">
              <option value="new">جديد</option><option value="preparing">قيد التجهيز</option>
              <option value="ready">جاهز</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option>
            </select></td>
          </tr>)}</tbody></table>
          {orders.length === 0 && <p className="p-4">لا توجد طلبات محفوظة. سنربط زر الواتساب بالحفظ في الخطوة التالية.</p>}
        </div>}

        {tab === "reports" && <div className="grid md:grid-cols-3 gap-4">
          <article className="bg-white border rounded-2xl p-5">المبيعات المكتملة<strong className="block text-2xl mt-2">{sales.toFixed(2)} ر.س</strong></article>
          <article className="bg-white border rounded-2xl p-5">عدد الطلبات المكتملة<strong className="block text-2xl mt-2">{completed.length}</strong></article>
          <article className="bg-white border rounded-2xl p-5">متوسط الطلب<strong className="block text-2xl mt-2">{completed.length ? (sales / completed.length).toFixed(2) : "0.00"} ر.س</strong></article>
          <p className="md:col-span-3 text-sm text-gray-500">ستظهر هنا الطلبات المحفوظة في قاعدة البيانات فقط. الرسائل القديمة في واتساب لا تُحتسب تلقائيًا.</p>
        </div>}
      </div>
    </main>
  );
}

