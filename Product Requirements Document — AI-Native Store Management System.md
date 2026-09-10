# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## AI-NATIVE STORE MANAGEMENT SYSTEM

**Version:** 1.0  
**Status:** Draft for Review  
**Document Type:** Product Requirements Document  
**Target:** Capstone / Academic Software Project

---

# 1. Product Overview

## 1.1 Product Name

**AI-Native Store Management System**

Nama dapat berubah pada tahap branding, tetapi istilah ini digunakan sebagai working title dalam PRD.

---

## 1.2 Product Summary

AI-Native Store Management System adalah sistem manajemen toko yang mengintegrasikan **conversational AI** ke dalam proses interaksi customer dan aktivitas operasional internal toko.

Sistem memiliki dua sisi utama:

1. **Customer-facing interaction**
   - Web Chat
   - WhatsApp

2. **Internal store management**
   - Admin Panel untuk Staff dan Owner
   - AI Business Analyst
   - AI Action Assistant
   - Approval dan Audit

Customer tidak menggunakan aplikasi e-commerce khusus untuk melakukan pembelian. Customer berinteraksi melalui percakapan.

Alur utamanya:

```text
Customer
   ↓
Web Chat / WhatsApp
   ↓
AI Sales Agent
   ↓
Product Discovery / Recommendation
   ↓
Order Summary
   ↓
Customer Confirmation
   ↓
Backend Validation
   ↓
Order
```

Sementara pengguna internal menggunakan Admin Panel:

```text
Staff / Owner
      ↓
 Admin Panel
      ↓
Store Management
      +
AI Business Analyst
      +
AI Action Assistant
```

Sistem bukan POS dan tidak berfokus pada transaksi pembayaran di kasir.

---

# 2. Product Vision

## 2.1 Vision Statement

Membangun sistem manajemen toko yang menjadikan AI sebagai lapisan interaksi dan intelligence sehingga customer dapat berbelanja melalui percakapan, sementara Staff dan Owner dapat mengelola dan memahami operasional toko melalui satu sistem terintegrasi.

---

## 2.2 Product Positioning

Produk diposisikan sebagai:

> **AI-native store management system dengan conversational commerce dan AI-assisted business operations.**

Produk bukan:

- POS;
- marketplace;
- payment gateway;
- chatbot FAQ sederhana;
- aplikasi e-commerce customer penuh;
- autonomous business management system.

---

# 3. Problem Statement

## 3.1 Customer Problem

Dalam proses pembelian konvensional, customer sering harus:

1. mencari produk secara manual;
2. membaca banyak informasi produk;
3. membandingkan beberapa produk;
4. bertanya kepada staff;
5. menunggu respons staff;
6. kemudian menyampaikan keputusan pembelian.

Masalah menjadi lebih besar ketika customer memiliki kebutuhan yang tidak dapat diekspresikan hanya dengan nama produk.

Contoh:

> "Saya butuh laptop untuk programming, budget sekitar 10 juta, tapi saya juga ingin yang baterainya cukup awet."

Customer sebenarnya menyampaikan **kebutuhan**, bukan sekadar nama produk.

Sistem harus mampu menerjemahkan kebutuhan tersebut menjadi pencarian dan rekomendasi produk yang relevan.

---

## 3.2 Store Management Problem

Dari sisi toko, pengelolaan operasional membutuhkan aktivitas seperti:

- mengelola produk;
- mengelola stok;
- memantau order;
- mengelola promotion;
- memantau percakapan customer;
- memahami performa penjualan;
- melakukan tindakan administratif.

Sebagian aktivitas tersebut bersifat repetitif dan membutuhkan interpretasi data.

Sistem bertujuan mengurangi beban tersebut melalui AI tanpa menyerahkan kontrol operasional sepenuhnya kepada AI.

---

# 4. Product Goals

## 4.1 Primary Goals

### Goal 1 — Conversational Product Discovery

Customer dapat menemukan produk berdasarkan kebutuhan yang disampaikan menggunakan bahasa natural.

### Goal 2 — Conversational Ordering

Customer dapat menyelesaikan proses pemesanan melalui percakapan sampai tahap explicit order confirmation.

### Goal 3 — Centralized Store Management

Staff dan Owner dapat mengelola operasional toko melalui satu Admin Panel.

### Goal 4 — AI-Assisted Business Understanding

Owner dapat mengajukan pertanyaan bisnis menggunakan bahasa natural dan memperoleh jawaban berdasarkan data toko.

### Goal 5 — Controlled AI Operations

Staff dapat menggunakan AI untuk menyusun administrative action, tetapi execution tetap dikontrol oleh Owner.

### Goal 6 — Multi-Channel Architecture

Customer dapat menggunakan Web Chat maupun WhatsApp dengan business logic AI yang sama.

---

# 5. Non-Goals

Fitur berikut tidak menjadi tujuan MVP:

- payment processing;
- POS/cashier functionality;
- payment gateway;
- marketplace integration;
- loyalty program;
- customer mobile application;
- Telegram integration;
- automatic cross-channel customer identity matching;
- autonomous administrative execution tanpa approval;
- autonomous pricing;
- autonomous inventory policy;
- full accounting system;
- ERP;
- delivery/logistics management.

---

# 6. Target Users

## 6.1 Customer

Customer adalah pengguna eksternal yang berinteraksi dengan toko melalui:

- Web Chat;
- WhatsApp.

Customer tidak perlu login ke Admin Panel.

Customer menggunakan sistem untuk:

- mencari produk;
- bertanya mengenai produk;
- meminta rekomendasi;
- membandingkan produk;
- memberikan informasi kebutuhan;
- melakukan order;
- mengonfirmasi order.

---

## 6.2 Staff

Staff adalah pengguna internal yang menangani operasional toko.

Staff dapat:

- mengelola data operasional sesuai permission;
- memantau order;
- memantau inventory;
- melihat conversation;
- menggunakan AI Business Analyst;
- meminta AI membuat administrative action;
- mengirim action untuk approval Owner.

Staff tidak dapat melakukan execution terhadap AI-generated administrative action tanpa approval Owner.

---

## 6.3 Owner

Owner adalah pengguna dengan hak kontrol tertinggi pada sistem.

Owner dapat:

- melakukan seluruh aktivitas yang diizinkan sistem;
- mengelola operasional;
- menggunakan AI Business Analyst;
- meninjau AI Action;
- approve/reject action;
- memonitor audit;
- mengawasi aktivitas sistem.

Owner berfungsi sebagai **human authority** terhadap AI-generated administrative actions.

---

# 7. Product Experience

## 7.1 High-Level Experience

Produk memiliki tiga pengalaman utama:

```text
                    SYSTEM
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       CUSTOMER      UNDERSTAND     ACT
          │              │            │
          ▼              ▼            ▼
      AI SALES       BUSINESS AI   ACTION AI
        AGENT         ANALYST       ASSISTANT
          │              │            │
          ▼              ▼            ▼
       SELLING         INSIGHT      OPERATION
```

---

# 8. Customer Journey

## 8.1 Customer Entry

Customer dapat memulai interaksi melalui:

```text
Web Chat
   atau
WhatsApp
```

Kedua channel harus menggunakan core AI Sales Agent yang sama.

---

## 8.2 Product Inquiry

Contoh:

> Customer: "Ada laptop untuk mahasiswa teknik di bawah 10 juta?"

AI:

1. memahami kebutuhan;
2. mengekstrak constraint;
3. mencari produk;
4. melakukan filtering;
5. menghasilkan rekomendasi;
6. menjelaskan alasan rekomendasi.

---

## 8.3 Product Recommendation

AI tidak hanya mengembalikan nama produk.

Response ideal:

```text
Produk A
Harga: RpX
RAM: 16 GB
Storage: 512 GB
Processor: XXX

Alasan:
- sesuai budget;
- RAM cukup untuk development;
- storage memenuhi kebutuhan;
- stok tersedia.
```

AI harus menggunakan data produk yang tersedia di sistem.

---

## 8.4 Product Comparison

Customer dapat meminta perbandingan.

Contoh:

> "Bagusan A atau B untuk programming?"

AI harus membandingkan berdasarkan atribut produk yang tersedia.

AI tidak boleh mengarang spesifikasi yang tidak tersedia.

---

# 9. Conversational Order Flow

## 9.1 No Cart

MVP **tidak menggunakan Cart entity**.

Customer langsung menuju Order Confirmation.

Flow:

```text
Conversation
     ↓
Product Selection
     ↓
Order Summary
     ↓
Customer Confirmation
     ↓
Backend Validation
     ↓
Create Order
```

---

## 9.2 Order Summary

Sebelum order dibuat, sistem menampilkan ringkasan:

- product;
- quantity;
- applicable promotion;
- estimated total;
- customer information yang diperlukan.

Contoh:

```text
Pesanan Anda:

Laptop A × 1
Harga: Rp9.500.000

Diskon: Rp500.000

Total: Rp9.000.000

[Konfirmasi Pesanan]
```

---

## 9.3 Explicit Customer Confirmation

Order hanya boleh dibuat setelah customer memberikan explicit confirmation.

Confirmation dapat berupa:

- button;
- structured confirmation;
- atau mekanisme channel yang ekuivalen.

AI tidak boleh menganggap:

> "Kayaknya saya ambil."

sebagai confirmation final jika sistem membutuhkan explicit confirmation.

---

## 9.4 Backend Validation

Setelah confirmation:

```text
Customer Confirmation
       ↓
Backend
       ↓
Validate Product
       ↓
Validate Stock
       ↓
Validate Promotion
       ↓
Validate Customer Data
       ↓
Create Order
```

AI bukan authority terakhir.

Backend adalah authority untuk validasi dan transaksi.

---

# 10. Web Chat

## 10.1 Purpose

Web Chat merupakan **customer channel wajib** untuk MVP.

Web Chat menyediakan akses langsung ke AI Sales Agent tanpa memerlukan aplikasi customer khusus.

---

## 10.2 Core Capabilities

Customer dapat:

- memulai conversation;
- bertanya mengenai produk;
- menerima recommendation;
- meminta comparison;
- melakukan order;
- melakukan confirmation.

---

## 10.3 Session

Setiap conversation Web Chat harus memiliki session/context yang memungkinkan AI mempertahankan konteks percakapan selama session yang relevan.

---

# 11. WhatsApp Integration

## 11.1 Purpose

WhatsApp merupakan **integrated external customer channel wajib**.

Tujuannya memungkinkan customer berinteraksi dengan AI Sales Agent melalui platform messaging yang umum digunakan.

---

## 11.2 Architecture

```text
Customer
   ↓
WhatsApp
   ↓
WhatsApp Channel Adapter
   ↓
AI Sales Agent Core
   ↓
Store Backend
```

WhatsApp Adapter bertanggung jawab terhadap perbedaan protokol/channel.

AI Sales Agent tidak boleh memiliki business logic khusus WhatsApp.

---

## 11.3 Required Capabilities

Integration harus mendukung:

- incoming customer message;
- outgoing AI response;
- conversation identification;
- webhook/event handling;
- order confirmation;
- message delivery handling;
- channel-specific constraints.

---

## 11.4 WhatsApp Constraint

Sistem harus memperhatikan aturan platform seperti:

- conversation window;
- template message;
- webhook;
- provider configuration.

Detail provider merupakan implementation dependency dan bukan business logic AI.

---

# 12. Channel Abstraction

Sistem menggunakan Channel Adapter.

```text
              ┌──────────────┐
              │  Web Adapter │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │              │
              │ AI Sales     │
              │ Agent Core   │
              │              │
              └──────────────┘
                     ▲
                     │
              ┌──────┴───────┐
              │   WhatsApp   │
              │   Adapter    │
              └──────────────┘
```

Tujuan:

- menghindari duplicate business logic;
- menjaga konsistensi behavior AI;
- memungkinkan channel baru ditambahkan kemudian.

Telegram tidak termasuk MVP.

---

# 13. Admin Panel

## 13.1 Purpose

Admin Panel adalah satu interface internal yang digunakan oleh:

- Staff;
- Owner.

Tidak diperlukan aplikasi admin terpisah untuk setiap role.

Perbedaan akses ditentukan oleh role dan permission.

---

# 14. Product Management

Admin dapat:

- melihat product;
- membuat product;
- mengubah product;
- mengaktifkan/nonaktifkan product;
- mengelola atribut produk;
- mengelola harga;
- melihat status stok.

Product data menjadi salah satu sumber utama AI Sales Agent.

---

# 15. Inventory Management

Admin dapat:

- melihat current stock;
- melihat inventory transaction;
- melakukan stock adjustment sesuai permission;
- memonitor low stock;
- melihat perubahan stok.

Inventory menjadi source of truth untuk availability.

AI tidak boleh mengklaim produk tersedia jika backend menyatakan produk tidak tersedia.

---

# 16. Order Management

Admin Panel menyediakan:

- daftar order;
- detail order;
- customer;
- product;
- quantity;
- total;
- status;
- timestamp;
- channel origin.

Order yang berasal dari conversational AI harus dapat dilacak ke conversation yang relevan.

---

# 17. Promotion Management

Admin dapat mengelola:

- promotion;
- discount;
- validity period;
- product scope;
- promotion status.

Promotion harus divalidasi oleh backend sebelum diterapkan ke order.

---

# 18. Customer Management

Admin dapat melihat customer profile berdasarkan channel identity.

MVP tidak melakukan automatic identity unification.

Contoh:

```text
Customer #001
Channel: Web

Customer #002
Channel: WhatsApp
```

Keduanya dapat berasal dari orang yang sama, tetapi sistem MVP tidak menganggap keduanya sebagai satu identity.

---

# 19. Conversation Management

Staff/Owner dapat melihat:

- conversation;
- channel;
- customer;
- message history;
- recommendation;
- order outcome;
- timestamp.

Conversation harus dapat difilter berdasarkan channel.

Tujuan fitur:

1. monitoring;
2. customer service;
3. debugging AI;
4. evaluasi recommendation;
5. audit interaksi.

---

# 20. AI Sales Agent

## 20.1 Product Role

AI Sales Agent adalah customer-facing AI yang membantu customer menemukan produk dan melakukan order.

---

## 20.2 Core Responsibilities

AI Sales Agent bertanggung jawab untuk:

1. memahami customer intent;
2. mengekstrak kebutuhan;
3. mencari produk;
4. melakukan filtering;
5. memberikan recommendation;
6. menjelaskan recommendation;
7. menjawab product inquiry;
8. melakukan comparison;
9. mempertahankan conversation context;
10. menyusun order summary;
11. meminta explicit confirmation;
12. memproses flow order melalui backend.

---

# 21. AI Sales Agent — Grounding

AI Sales Agent harus menggunakan data sistem sebagai sumber utama untuk:

- nama produk;
- harga;
- stok;
- atribut;
- promotion;
- order-related information.

AI tidak boleh mengarang informasi operasional.

Jika informasi tidak tersedia:

> AI harus menyatakan bahwa informasi tersebut tidak tersedia atau meminta customer mengklarifikasi kebutuhannya.

---

# 22. AI Sales Agent — Recommendation Logic

Recommendation harus mempertimbangkan constraint customer seperti:

- budget;
- category;
- required specification;
- intended use;
- quantity;
- availability.

Jika beberapa produk memenuhi kebutuhan, AI dapat memberikan ranking atau shortlist.

AI harus menjelaskan alasan rekomendasi secara grounded.

---

# 23. AI Business Analyst

## 23.1 Purpose

AI Business Analyst membantu Staff/Owner memahami data bisnis melalui natural language.

Contoh:

> "Produk apa yang paling banyak terjual bulan ini?"

> "Produk mana yang stoknya mulai kritis?"

> "Bagaimana penjualan minggu ini dibanding minggu lalu?"

---

## 23.2 Processing Flow

```text
Natural Language Question
          ↓
Intent Interpretation
          ↓
Determine Required Data
          ↓
Structured Query / Analysis
          ↓
Result Validation
          ↓
Natural Language Explanation
```

AI Business Analyst tidak boleh menghasilkan angka bisnis tanpa basis data.

---

## 23.3 Traceability

Jawaban analytical harus dapat ditelusuri ke data atau query yang digunakan.

Tujuannya mengurangi risiko:

- hallucination;
- incorrect metric;
- unsupported conclusion.

---

# 24. AI Action Assistant

## 24.1 Purpose

AI Action Assistant memungkinkan Staff/Owner menyampaikan administrative intent menggunakan natural language.

Contoh:

> "Naikkan stok produk X menjadi 20."

> "Buat promo 10% untuk produk X sampai tanggal 30."

> "Nonaktifkan produk Y."

> "Ubah harga produk Z."

---

# 25. Administrative Action Scope

Pada MVP, AI Action Assistant mendukung **seluruh administrative actions yang tersedia pada Admin Panel**, selama action tersebut:

1. merupakan operasi yang memang disediakan oleh sistem;
2. memiliki validation rule;
3. dapat direpresentasikan sebagai structured action;
4. memiliki authorization rule;
5. dapat dicatat pada audit log.

Contoh kategori:

### Product

- create product;
- update product;
- activate/deactivate product;
- update product attributes;
- update price.

### Inventory

- stock adjustment;
- inventory correction;
- stock status update.

### Promotion

- create promotion;
- update promotion;
- activate/deactivate promotion.

### Order Administration

- administrative order status update sesuai state machine;
- order cancellation jika business rule mengizinkan.

### Customer / Conversation Administration

- administrative updates yang memang disediakan oleh sistem.

AI tidak diperbolehkan membuat operasi baru di luar action catalog.

---

# 26. AI Action Lifecycle

Semua AI-generated administrative action mengikuti:

```text
User Intent
     ↓
AI Interpretation
     ↓
Structured Draft
     ↓
Validation
     ↓
Owner Review
   ↙       ↘
Reject     Approve
             ↓
          Execute
             ↓
          Audit Log
```

---

# 27. Human-in-the-Loop

AI Action Assistant **tidak melakukan autonomous administrative execution**.

Contoh:

Staff:

> "Buat diskon 20% untuk Laptop A."

AI:

```text
Action:
CREATE_PROMOTION

Product:
Laptop A

Discount:
20%

Start:
2026-XX-XX

End:
2026-XX-XX
```

Kemudian:

```text
[Approve] [Reject]
```

Owner memilih:

> Approve

Barulah backend melakukan execution.

---

# 28. Validation Responsibility

AI bertugas:

- memahami intent;
- menghasilkan draft;
- memberikan parameter.

Backend bertugas:

- authorization;
- validation;
- business rule;
- transaction;
- persistence;
- execution.

Ini merupakan boundary penting.

```text
AI = Interpreter / Assistant

Backend = Authority
```

---

# 29. Audit

Setiap AI administrative action harus menghasilkan audit information.

Minimal:

- actor;
- action type;
- target;
- generated parameters;
- creation time;
- approval status;
- approver;
- execution result;
- execution time;
- failure information jika ada.

Audit diperlukan agar setiap AI-generated operational change dapat ditelusuri.

---

# 30. Role & Permission Model

## Customer

Akses:

- Web Chat;
- WhatsApp;
- product inquiry;
- recommendation;
- order confirmation.

Tidak memiliki akses Admin Panel.

---

## Staff

Akses:

- Admin Panel;
- operational management sesuai permission;
- conversation monitoring;
- business analysis;
- AI Action drafting.

Tidak dapat approve AI administrative action.

---

## Owner

Akses:

- seluruh Admin Panel;
- business analysis;
- AI Action approval;
- action rejection;
- audit;
- operational management.

---

# 31. Core Business Rules

## BR-01 — Backend Authority

Backend merupakan sumber kebenaran untuk data operasional.

---

## BR-02 — AI Grounding

AI harus menggunakan data sistem untuk informasi yang bersifat operational/factual.

---

## BR-03 — No Autonomous Administrative Execution

AI tidak boleh secara autonomous menjalankan administrative write operation.

---

## BR-04 — Owner Approval

AI-generated administrative action harus mendapatkan approval Owner sebelum execution.

---

## BR-05 — Customer Order Exception

Customer order merupakan customer-initiated transaction.

Flow:

```text
Customer Confirmation
+
Backend Validation
=
Order Creation
```

Owner approval tidak diperlukan untuk setiap customer order karena hal tersebut akan membuat conversational commerce tidak praktis.

---

## BR-06 — No Cart

MVP tidak memiliki Cart entity.

Order dibuat setelah explicit customer confirmation.

---

## BR-07 — Stock Validation

Order tidak boleh dibuat jika quantity yang diminta tidak memenuhi availability rule.

---

## BR-08 — Promotion Validation

Promotion hanya berlaku jika memenuhi:

- validity period;
- product scope;
- status;
- applicable business rules.

---

## BR-09 — Channel Independence

Business logic tidak boleh bergantung langsung pada channel.

---

## BR-10 — Customer Identity

Customer identity pada MVP bersifat channel-specific.

---

# 32. Data Model — Product Perspective

Core entities:

```text
User
Product
InventoryTransaction
Promotion
Order
OrderItem
Customer
Conversation
ConversationMessage
Recommendation
AIAction
Approval
AuditLog
```

Tidak terdapat:

```text
Cart
CartItem
Payment
```

dalam MVP.

---

# 33. Core Relationship

Konseptual:

```text
Customer
   │
   └── Conversation
          │
          ├── ConversationMessage
          ├── Recommendation
          └── Order
                 │
                 └── OrderItem
                        │
                        └── Product
```

Inventory:

```text
Product
   │
   └── InventoryTransaction
```

AI Action:

```text
User
 ↓
AIAction
 ↓
Approval
 ↓
Execution
 ↓
AuditLog
```

---

# 34. Customer Conversation Model

Conversation merupakan unit utama customer interaction.

Conversation minimal memiliki:

- customer;
- channel;
- start time;
- last activity;
- status;
- messages;
- recommendation context;
- order relationship jika ada.

---

# 35. Product Success Metrics

## 35.1 Customer Metrics

MVP dapat mengukur:

### Recommendation Success Rate

Persentase conversation yang menghasilkan recommendation yang relevan berdasarkan evaluation criteria.

### Order Conversion

```text
Confirmed Orders
----------------------------
Eligible Shopping Conversations
```

### Recommendation-to-Order Rate

Mengukur berapa banyak conversation dengan recommendation yang berlanjut ke order.

---

# 36. AI Quality Metrics

## Sales Agent

Evaluasi:

- intent understanding;
- product retrieval accuracy;
- recommendation relevance;
- hallucination rate;
- order extraction accuracy;
- confirmation correctness.

---

## Business Analyst

Evaluasi:

- query interpretation accuracy;
- numerical accuracy;
- grounding;
- explanation quality.

---

## Action Assistant

Evaluasi:

- intent parsing;
- parameter extraction;
- validation correctness;
- action draft accuracy;
- execution correctness.

---

# 37. Operational Metrics

System dapat mengukur:

- order volume;
- inventory activity;
- promotion activity;
- conversation volume;
- channel distribution;
- AI action volume;
- approval rate;
- rejection rate;
- execution failure rate.

---

# 38. Non-Functional Product Requirements

## Performance

Customer tidak boleh menunggu terlalu lama untuk response AI dalam kondisi normal.

Sistem harus menetapkan target latency yang realistis setelah model dan infrastructure dipilih.

---

## Availability

Admin Panel dan core backend harus tersedia selama jam operasional sistem.

---

## Security

Sistem harus menerapkan:

- authentication;
- authorization;
- role-based access;
- protected credentials;
- secure webhook handling;
- secure API communication.

---

## Data Integrity

Administrative transaction harus bersifat consistent dan tidak menghasilkan partial state yang invalid.

---

## Auditability

Administrative AI actions harus dapat ditelusuri.

---

## Maintainability

Channel adapter dan AI core harus dipisahkan agar perubahan channel tidak memerlukan perubahan besar pada business logic.

---

# 39. AI Safety & Guardrails

## Guardrail 1 — No Hallucinated Product Data

AI tidak boleh mengarang:

- harga;
- stok;
- spesifikasi;
- promotion.

---

## Guardrail 2 — No Direct Database Access

AI tidak memiliki direct database access.

AI hanya berinteraksi melalui tool/function interface yang disediakan backend.

---

## Guardrail 3 — No Unauthorized Action

AI tidak boleh melakukan administrative write operation tanpa approval yang diperlukan.

---

## Guardrail 4 — Structured Action

AI-generated action harus menghasilkan structured representation sebelum execution.

Contoh:

```json
{
  "action": "UPDATE_PRODUCT",
  "product_id": "P001",
  "changes": {
    "price": 9500000
  }
}
```

Backend kemudian melakukan validation.

---

## Guardrail 5 — No Unsupported Operation

Jika AI tidak memiliki tool untuk melakukan suatu operasi, AI tidak boleh berpura-pura bahwa operasi tersebut telah dilakukan.

---

# 40. MVP Scope

## MUST HAVE

### Customer

- Web Chat;
- WhatsApp integration;
- product inquiry;
- recommendation;
- comparison;
- conversational context;
- order summary;
- explicit order confirmation;
- order creation.

### Admin

- authentication;
- Staff role;
- Owner role;
- product management;
- inventory management;
- order management;
- promotion management;
- customer management;
- conversation monitoring.

### AI

- AI Sales Agent;
- AI Business Analyst;
- AI Action Assistant;
- tool/function calling;
- grounding;
- validation;
- human approval;
- audit.

---

# 41. Explicitly Excluded from MVP

- Cart entity;
- payment;
- POS;
- cashier;
- Telegram;
- autonomous administrative execution;
- automatic cross-channel identity matching;
- customer mobile application;
- accounting;
- delivery management;
- marketplace;
- loyalty system.

---

# 42. Stretch / Future Features

Fitur berikut dapat dipertimbangkan setelah MVP stabil:

- Telegram adapter;
- cross-channel customer identity;
- advanced upselling;
- cross-selling;
- down-selling;
- advanced customer segmentation;
- predictive sales analytics;
- demand forecasting;
- advanced recommendation personalization;
- additional messaging channels.

Stretch features tidak boleh mengganggu completion MVP.

---

# 43. Critical User Stories

## US-01 — Product Discovery

**As a customer**,  
I want to describe what product I need using natural language,  
so that I can receive relevant recommendations without manually searching every product.

### Acceptance Criteria

- AI memahami kebutuhan utama;
- sistem mencari produk berdasarkan data aktual;
- recommendation memiliki alasan;
- AI tidak mengarang data produk.

---

## US-02 — Product Comparison

**As a customer**,  
I want to compare products,  
so that I can make a purchase decision.

### Acceptance Criteria

- AI mengambil data dari product catalog;
- comparison berdasarkan atribut tersedia;
- AI tidak mengarang atribut.

---

## US-03 — Conversational Order

**As a customer**,  
I want to confirm a recommended product directly in the conversation,  
so that I do not need to use a separate checkout/cart system.

### Acceptance Criteria

- AI menampilkan order summary;
- customer memberikan explicit confirmation;
- backend melakukan validation;
- order dibuat setelah validation berhasil.

---

## US-04 — Inventory Management

**As a Staff**,  
I want to manage inventory,  
so that product availability remains accurate.

---

## US-05 — Conversation Monitoring

**As a Staff**,  
I want to inspect customer conversations,  
so that I can understand customer interactions and monitor AI behavior.

---

## US-06 — Business Analysis

**As an Owner**,  
I want to ask business questions in natural language,  
so that I can understand store performance without manually constructing queries.

---

## US-07 — AI Administrative Action

**As a Staff**,  
I want to ask AI to prepare an administrative action,  
so that repetitive operational tasks can be prepared more efficiently.

---

## US-08 — Action Approval

**As an Owner**,  
I want to review AI-generated actions before execution,  
so that I retain operational control over the system.

---

# 44. End-to-End Example

## Scenario A — Customer Purchase

```text
Customer
"Pak, ada laptop untuk programming sekitar 10 juta?"

        ↓

AI Sales Agent

        ↓

Extract:
- category = laptop
- use case = programming
- budget <= 10M

        ↓

Product Search

        ↓

Candidate Products

        ↓

Recommendation

        ↓

Customer:
"Saya pilih yang kedua."

        ↓

AI:
"Berikut pesanan Anda..."

        ↓

[Konfirmasi Pesanan]

        ↓

Customer clicks confirmation

        ↓

Backend Validation

        ↓

Create Order

        ↓

Update relevant inventory state

        ↓

Return order confirmation
```

---

# 45. End-to-End Example — Business Analysis

```text
Owner:
"Produk apa yang paling banyak terjual bulan ini?"

        ↓

AI Business Analyst

        ↓

Interpret question

        ↓

Query order data

        ↓

Aggregate sales

        ↓

Validate result

        ↓

AI response

"Produk X memiliki penjualan tertinggi
dengan XX unit."
```

Jawaban harus dapat ditelusuri ke data yang digunakan.

---

# 46. End-to-End Example — Administrative Action

```text
Staff:
"Buat promo 15% untuk produk X sampai akhir bulan."

        ↓

AI Action Assistant

        ↓

Draft:
CREATE_PROMOTION
Product = X
Discount = 15%
End = ...

        ↓

Validation

        ↓

Owner

[Approve] [Reject]

        ↓

Approve

        ↓

Backend Execution

        ↓

Promotion Created

        ↓

Audit Log
```

---

# 47. Error Handling

## Product Not Found

AI harus menjelaskan bahwa produk yang dicari tidak ditemukan dan dapat menawarkan alternatif.

---

## Insufficient Stock

AI harus memberi tahu customer bahwa quantity yang diminta tidak tersedia.

---

## Invalid Promotion

Backend menolak promotion yang tidak memenuhi business rule.

AI harus menyampaikan hasil backend, bukan mengklaim promotion berhasil.

---

## AI Cannot Understand Intent

AI harus meminta clarification daripada melakukan asumsi berisiko.

---

## Action Validation Failure

Draft action dikembalikan dengan alasan validation failure.

---

## AI Service Failure

Sistem harus memberikan fallback response yang jelas dan tidak berpura-pura bahwa AI telah menjalankan operasi.

---

# 48. Dependencies

Produk bergantung pada:

- LLM provider;
- Web application;
- backend API;
- database;
- WhatsApp Business/API provider;
- authentication mechanism;
- hosting/infrastructure.

Provider-specific implementation harus diisolasi sejauh memungkinkan.

---

# 49. Major Risks

## Risk 1 — LLM Hallucination

**Impact:** tinggi.

**Mitigation:**

- grounding;
- tool calling;
- backend authority;
- validation;
- no direct DB access.

---

## Risk 2 — WhatsApp Integration Complexity

**Impact:** tinggi.

**Mitigation:**

- Channel Adapter;
- sandbox/testing;
- provider abstraction;
- fallback Web Chat.

---

## Risk 3 — Scope Creep

**Impact:** sangat tinggi.

**Mitigation:**

MVP harus dibekukan sebelum implementation.

---

## Risk 4 — AI Action Mis-execution

**Impact:** sangat tinggi.

**Mitigation:**

```text
AI Draft
 ↓
Validation
 ↓
Owner Approval
 ↓
Execution
 ↓
Audit
```

---

## Risk 5 — Incorrect Business Analysis

**Impact:** tinggi.

**Mitigation:**

- structured query;
- grounded data;
- result validation;
- traceability.

---

# 50. Product Architecture Principle

Arsitektur produk harus mengikuti prinsip:

> **AI interprets; backend validates and executes.**

Secara konseptual:

```text
               AI LAYER
                  │
       ┌──────────┼──────────┐
       │          │          │
      SELL    UNDERSTAND     ACT
       │          │          │
       └──────────┼──────────┘
                  │
             TOOL LAYER
                  │
                  ▼
        STORE MANAGEMENT CORE
                  │
                  ▼
               DATABASE
```

AI bukan pengganti backend.

AI adalah intelligence/interface layer di atas business system.

---

# 51. Definition of Done — MVP

MVP dianggap selesai apabila:

### Customer

- customer dapat masuk melalui Web Chat;
- customer dapat berinteraksi melalui WhatsApp;
- customer dapat mencari produk;
- customer mendapatkan recommendation;
- customer dapat membandingkan produk;
- customer dapat melakukan explicit order confirmation;
- order tersimpan secara valid.

### Admin

- Staff dapat menggunakan Admin Panel;
- Owner dapat menggunakan Admin Panel;
- product dapat dikelola;
- inventory dapat dikelola;
- order dapat dipantau;
- promotion dapat dikelola;
- conversation dapat dipantau.

### AI

- Sales Agent dapat menggunakan product/inventory tools;
- Business Analyst menghasilkan jawaban grounded;
- Action Assistant menghasilkan structured draft;
- Owner dapat approve/reject;
- approved action dapat dieksekusi;
- action tercatat pada audit.

### Integration

- Web Chat berjalan;
- WhatsApp integration berjalan;
- kedua channel menggunakan core AI logic yang sama.

---

# 52. Product Boundary

Batas sistem secara sederhana:

```text
                    OUTSIDE SYSTEM

              Customer / WhatsApp
                       │
                       ▼
              ┌─────────────────┐
              │ CHANNEL ADAPTER │
              └────────┬────────┘
                       │
                       ▼
┌─────────────────────────────────────────┐
│              PRODUCT SYSTEM             │
│                                         │
│  AI Sales Agent                         │
│  AI Business Analyst                    │
│  AI Action Assistant                    │
│                                         │
│  Store Management Core                  │
│                                         │
│  Product / Inventory / Order / Promo    │
│  Customer / Conversation                │
│  Approval / Audit                       │
│                                         │
└─────────────────────────────────────────┘
                       │
                       ▼
                    Database
```

Payment, accounting, delivery, marketplace, dan sistem eksternal lain berada di luar boundary MVP.

---

# 53. Product Principles

## Principle 1 — Conversation First

Untuk customer, conversation menjadi interface utama.

---

## Principle 2 — One Core, Multiple Channels

Channel dapat berbeda, tetapi business logic tetap satu.

---

## Principle 3 — Backend Is the Authority

AI tidak menentukan kebenaran data operasional.

---

## Principle 4 — Human Control

AI dapat membantu membuat keputusan/action, tetapi administrative execution tetap berada di bawah kontrol Owner.

---

## Principle 5 — No Fake Intelligence

AI tidak boleh terlihat pintar dengan cara mengarang data.

Jawaban yang tidak diketahui lebih baik daripada jawaban yang salah.

---

## Principle 6 — Scope Discipline

Fitur yang tidak diperlukan untuk membuktikan core product value tidak boleh masuk MVP hanya karena secara teknis menarik.

---

# 54. Final Product Definition

Jika harus dijelaskan dalam satu kalimat kepada dosen:

> **AI-Native Store Management System adalah sistem manajemen toko yang menggunakan conversational AI sebagai interface customer melalui Web Chat dan WhatsApp untuk product discovery, recommendation, dan conversational ordering, serta menggunakan AI Business Analyst dan AI Action Assistant untuk membantu Staff dan Owner memahami data dan melakukan administrative operations dengan human approval.**

Jika dosen bertanya:

> **"Jadi ini POS?"**

Jawaban:

> **"Bukan. POS berfokus pada point-of-sale dan transaksi pembayaran. Sistem kami tidak menangani kasir atau payment. Fokus kami adalah conversational commerce dan AI-assisted store management."**

Jika dosen bertanya:

> **"Customer pakai aplikasi apa?"**

Jawaban:

> **"Customer tidak membutuhkan Admin Panel. Customer berinteraksi melalui Web Chat atau WhatsApp."**

Jika dosen bertanya:

> **"AI-nya melakukan apa?"**

Jawaban:

> **"Ada tiga fungsi utama: Sales Agent untuk membantu customer menemukan dan membeli produk, Business Analyst untuk menganalisis data toko melalui natural language, dan Action Assistant untuk menyusun administrative action yang kemudian harus disetujui Owner sebelum dieksekusi."**

Jika dosen bertanya:

> **"Kenapa AI tidak langsung mengubah database?"**

Jawaban:

> **"Karena backend tetap menjadi authority. AI hanya menghasilkan intent atau structured action. Backend melakukan validation dan execution, sedangkan administrative action membutuhkan Owner approval untuk menjaga kontrol dan auditability."**

---

# 55. Final Scope Lock

Untuk baseline PRD ini, keputusan berikut dianggap **locked**:

| Area | Keputusan |
|---|---|
| Product type | AI-Native Store Management System |
| POS | Tidak |
| Payment | Tidak |
| Customer interface | Web Chat + WhatsApp |
| Web Chat | Mandatory |
| WhatsApp | Mandatory |
| Telegram | Tidak masuk MVP |
| Customer login | Tidak diperlukan untuk conversational entry |
| Cart | Tidak ada |
| Checkout | Tidak ada sebagai aplikasi terpisah |
| Order | Langsung melalui explicit confirmation |
| Admin UI | Satu Admin Panel |
| Internal roles | Staff + Owner |
| AI Sales Agent | Mandatory |
| AI Business Analyst | Mandatory |
| AI Action Assistant | Mandatory |
| Administrative AI scope | Seluruh administrative actions yang tersedia |
| AI autonomous admin execution | Tidak |
| Owner approval | Wajib untuk AI administrative actions |
| Direct AI DB access | Tidak |
| Backend validation | Wajib |
| Audit | Wajib |
| Cross-channel identity matching | Tidak masuk MVP |
| Payment/Accounting/Delivery | Tidak masuk MVP |

---

# 56. PRD Baseline Statement

Dokumen ini menjadi **product-level baseline**.

Perubahan terhadap:

- customer channel;
- ordering model;
- AI capability;
- role model;
- approval model;
- MVP boundary;

harus diperlakukan sebagai **scope change**, bukan perubahan kecil.

Penambahan fitur tidak boleh dilakukan hanya karena fitur tersebut menarik secara teknis.

Prioritas implementasi adalah:

```text
1. Core Store Management
2. AI Sales Agent
3. Web Chat
4. WhatsApp Integration
5. Conversational Order
6. AI Business Analyst
7. AI Action Assistant
8. Approval
9. Audit
10. Evaluation & Hardening
```

Tujuan akhir bukan membuat sistem dengan fitur sebanyak mungkin.

Tujuannya adalah menghasilkan satu sistem yang dapat membuktikan bahwa:

> **AI dapat menjadi interface penjualan dan intelligence layer untuk operasional toko, tanpa menghilangkan kontrol backend dan manusia atas data serta tindakan operasional.**