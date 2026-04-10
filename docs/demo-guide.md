# SeSPHR — Complete Demo Guide

> **Purpose:** Step-by-step demo script for the MTech Final Year Project panel presentation.
> Everything you need to do on screen + exactly what to say to the panel after each step.

---

## Before the Demo — Setup Checklist

Run these commands **before** entering the room. Have both servers running and the browser open.

```bash
# Terminal 1 — Backend
cd backend
.\venv\Scripts\activate        # Windows
python run.py

# Terminal 2 — Frontend
cd frontend
npm run dev
```

**Open in browser:** `http://localhost:5173`

**Demo accounts (already seeded):**

| Email | Password | Role | Attributes |
|---|---|---|---|
| `patient1@demo.com` | `Demo@1234` | Patient | — |
| `dr_cardio@demo.com` | `Demo@1234` | Doctor | Dept: Cardiology |
| `dr_ortho@demo.com` | `Demo@1234` | Doctor | Dept: Orthopedics |
| `admin@demo.com` | `Demo@1234` | Admin | — |

**Prepare a sample PHR file** — any PDF (e.g., a medical report template). Name it `patient_health_record.pdf`.

**Open 3 browser tabs before presenting:**
- Tab 1: Patient login (`patient1@demo.com`)
- Tab 2: Doctor login (`dr_cardio@demo.com`)
- Tab 3: Doctor login (`dr_ortho@demo.com`)
- Tab 4: Admin login (`admin@demo.com`)

---

## Demo Flow Overview

```
[1] Open the paper → explain the problem
[2] Patient: Upload PHR with portions + policy
[3] Doctor (Cardiology): Request access → SRS grants → decrypt
[4] Doctor (Orthopedics): Request access → SRS denies
[5] Patient: Revoke access → Doctor retries → denied
[6] Admin: Audit log with hash-chain verification
[7] Admin: Performance benchmark → SRS constant-time proof
[8] Wrap up
```

Total estimated time: **15–20 minutes**

---

## Step 1 — Set the Problem (2 min)

**What to show:** The paper PDF on screen. Point to Figure 1 (architecture diagram).

**What to say:**

> "The paper we're implementing is *SeSPHR: A Methodology for Secure Sharing of Personal Health Records in the Cloud* by Mazhar Ali et al., published in IEEE Transactions.
>
> The core problem it solves is this — when a patient stores their health record on a cloud server, that cloud is *untrusted*. The cloud provider could read it, a hacker could steal it, or an unauthorized doctor could access it.
>
> The paper proposes three things:
> **One** — store only *encrypted* records on the cloud.
> **Two** — a semi-trusted server called the SRS controls who can decrypt what.
> **Three** — the patient decides the policy. Not the hospital, not the cloud, not the SRS. The patient.
>
> Our project implements this exact methodology end-to-end."

---

## Step 2 — Patient Uploads a PHR with Granular Portions (4 min)

**What to do:**
1. Go to Tab 1 (Patient — `patient1@demo.com`)
2. Navigate to **My Files**
3. Select your sample PDF
4. Set the **global policy** to: `Role:Doctor AND Dept:Cardiology`
5. Add **portions**:
   - Portion name: `Medical Records` → policy: `Role:Doctor AND Dept:Cardiology`
   - Portion name: `Insurance Info` → policy: `Role:Doctor OR Role:Admin`
   - Portion name: `Personal Info` → policy: `Role:Admin`
6. Click **Upload**
7. Show the file appearing in the list with the policy badge

**What to say:**

> "The patient logs in and uploads their health record. But before the file leaves the browser, it is encrypted using AES-256 in GCM mode directly in the browser using the Web Crypto API. The server never sees the plaintext.
>
> The AES key is then wrapped — encrypted — using the SRS's RSA-2048 public key. So the cloud receives only ciphertext. It cannot decrypt anything even if it wanted to.
>
> Now here is the granular access control — which is one of the paper's key contributions. The patient doesn't just say *'give all doctors access'*. They define separate portions of the record with separate policies. The Cardiology doctor gets medical records. Any doctor or admin sees insurance info. Only the admin sees personal information. Each portion has its own encryption key."

---

## Step 3 — Authorised Doctor Requests Access and Decrypts (3 min)

**What to do:**
1. Go to Tab 2 (Doctor — `dr_cardio@demo.com`, Dept: Cardiology)
2. Navigate to **Files**
3. Show the attributes panel: `Role: Doctor`, `Dept: Cardiology`
4. Click **View** on the uploaded file
5. Watch the **SRS Processing banner** animate through its steps:
   - Contacting SRS
   - Evaluating Policy
   - Re-encrypting Key
6. File opens in the preview modal
7. Scroll down to show the **Cryptographic Proof panel** (original key blob vs re-encrypted key blob)

**What to say:**

> "The doctor logs in. You can see their attributes — Role: Doctor, Department: Cardiology. These are assigned by the admin and used by the SRS to evaluate the policy.
>
> When the doctor clicks View, three things happen on the SRS side — which you can see animated here:
> First, it authenticates the request. Second, it evaluates the policy — `Role:Doctor AND Dept:Cardiology` — against this doctor's attributes. It returns true. Third, it re-encrypts the AES key — not the file — for this specific doctor.
>
> The cloud stores the key encrypted for the SRS. The SRS decrypts it and immediately re-encrypts it for the doctor's public key. The AES key never travels in plaintext. The cloud never gets the key. The decryption happens entirely in this browser.
>
> And here — at the bottom — you can see the cryptographic proof. The original key blob stored on the cloud. And the re-encrypted key blob the SRS produced for this doctor. Same underlying AES key. Two different RSA ciphertexts. Only this doctor's private key can open the second one."

---

## Step 4 — Unauthorised Doctor is Denied (2 min)

**What to do:**
1. Go to Tab 3 (Doctor — `dr_ortho@demo.com`, Dept: Orthopedics)
2. Navigate to **Files**
3. Show the attributes: `Role: Doctor`, `Dept: Orthopedics`
4. Note the policy badge says **No access** (red)
5. Click **View** — it is disabled (greyed out)
6. If the panel wants to see a server-side denial, open browser DevTools → Network, click the row info button, then explain the server would return 403

**What to say:**

> "Now we switch to a different doctor — Dr. Priya, from Orthopedics. Same role, different department. Her attributes are Role: Doctor, Dept: Orthopedics.
>
> The policy on the file is `Role:Doctor AND Dept:Cardiology`. The AND means both conditions must be true. Orthopedics fails the second condition. The SRS evaluates this and returns a 403 — Access Denied.
>
> Notice the UI already reflects this — the access badge is red, the View button is disabled. The policy evaluation happens on both the client side for UI feedback and on the server side for enforcement. Even if the client were modified or bypassed, the SRS would still deny the request. The server is the authority."

---

## Step 5 — Patient Revokes Access (2 min)

**What to do:**
1. Go back to Tab 1 (Patient)
2. On the uploaded file, click the **Revoke** button
3. In the dialog, enter `dr_cardio`'s user ID (or use the full file revoke option)
4. Confirm revocation
5. Switch to Tab 2 (Dr. Cardiology) — refresh the page
6. Show the file now has a **Revoked** badge
7. The View button is now disabled for the previously authorised doctor too

**What to say:**

> "The patient can revoke access at any time. This is the forward access control property from the paper. Once revoked, even a previously authorised user cannot access the record.
>
> Internally, the SRS marks the user in the revoked list on the file's metadata. On the next access request, before the policy is even evaluated, the SRS checks this revoked list and returns a denial. The encryption on the cloud does not change — no re-encryption of the file is needed. The access control is enforced at the key distribution layer."

---

## Step 6 — Admin Views Tamper-Evident Audit Log (2 min)

**What to do:**
1. Go to Tab 4 (Admin — `admin@demo.com`)
2. Navigate to **Audit Logs**
3. Show the green **"All Audit Entries Verified"** banner at the top
4. Scroll through the table — show GRANTED, DENIED_POLICY, REVOKE entries
5. Point to the hash column (the green checkmark on each row)

**What to say:**

> "Every single action in the system is recorded in the audit log — every upload, every access grant, every denial, every revocation. This is the accountability property from the paper.
>
> But what makes this log trustworthy? It uses a SHA-256 hash chain — like a mini blockchain. Each log entry includes a hash of itself plus the hash of the previous entry. If anyone edits, deletes, or reorders even a single line, the chain breaks and the system immediately detects it and shows a tamper alert.
>
> The green banner here tells you the chain is intact — every entry verified. You can see the complete timeline: patient uploaded, Dr. Cardiology was granted access, Dr. Orthopedics was denied, and then the revocation event."

---

## Step 7 — Admin Views Performance Benchmarks (2 min)

**What to do:**
1. Navigate to **Performance** in the admin sidebar
2. Point to the purple insight banner at the top
3. Show the bar chart — all three operations across file sizes
4. Highlight the SRS line in the line chart — almost completely flat

**What to say:**

> "The paper's Section 6 includes a performance evaluation. We ran the same benchmarks on our implementation — measuring encryption, SRS re-encryption, and decryption times across file sizes from 100 KB to 10 MB.
>
> The most important result is this — the SRS re-encryption time is nearly constant at around 190 milliseconds, regardless of file size. You can see it in the line chart — the purple line is almost perfectly flat.
>
> Why? Because the SRS never touches the file. It only re-encrypts the 32-byte AES key. Whether the file is 100 KB or 10 MB, the key is always 32 bytes. This validates the core design decision of the SeSPHR methodology — separating data encryption from key management."

---

## Step 8 — Wrap Up (1 min)

**What to say:**

> "To summarise:
>
> The paper defines three things — encrypt data before it hits the cloud, use a semi-trusted SRS for key management and access control, and let the patient decide policy. Our implementation does all three.
>
> The patient encrypts in the browser, controls who accesses which portion of their record, and can revoke at any time. The SRS enforces the policy, re-encrypts the key, and logs everything in a tamper-evident chain. The cloud stores only ciphertext and cannot decrypt anything.
>
> The decryption happens entirely in the doctor's browser. Plaintext never travels over the network after upload.
>
> This is a proof-of-concept implementation of the SeSPHR methodology using hybrid encryption — AES-GCM for data, RSA-OAEP for key transport — with a boolean attribute-based policy engine that goes beyond what the original paper specifies."

---

## Anticipated Panel Questions — Prepared Answers

**Q: Why RSA instead of El-Gamal as the paper specifies?**
> "The paper uses El-Gamal with bilinear pairings as the cryptographic primitive. For our implementation, we used RSA-OAEP which is a well-established, NIST-approved standard. The mathematical security properties are equivalent — computationally hard to break without the private key. The architectural design — SRS as proxy, patient-centric control, portion-based access — is faithfully implemented. This is a proof of concept, and RSA is the appropriate choice for a practical implementation."

**Q: The SRS decrypts the AES key — doesn't that mean the SRS can read the data?**
> "Yes, the SRS is classified as *semi-trusted* in the paper. It is honest but curious — it follows the protocol but could theoretically inspect the key it handles for a millisecond. This is explicitly acknowledged in Section 4 of the paper. The mitigation is that the SRS is a controlled, audited server — not a cloud provider with millions of files. In a production system this would run in a trusted execution environment. The paper itself acknowledges SRS maintenance as a limitation."

**Q: What happens if the SRS goes down?**
> "This is a valid limitation the paper acknowledges. The SRS is a single point of failure for key management. In production, the SRS would be deployed with high availability. For this proof of concept, the SRS is the Flask backend server."

**Q: How is the audit log protected from the admin themselves tampering with it?**
> "Good question. In a production deployment, the audit log would be written to a write-once storage or a distributed ledger. The hash chain mechanism we've implemented means any modification is detectable — but the detection is only useful if the log is stored somewhere the admin cannot quietly replace the entire file. This is an open research problem in accountability systems."

**Q: Can a doctor who has been granted access share the decrypted file?**
> "Once data is decrypted in a browser, there's no technical way to prevent a user from taking a screenshot or saving the file. This is the end-of-chain problem — also called the *analog hole*. The SeSPHR paper doesn't address this either. It controls access at the cryptographic layer, not at the application layer. The audit log at least provides accountability if misuse is suspected."

**Q: What is the complexity compared to other schemes?**
> "The paper's Table III compares SeSPHR's computational complexity against two other schemes — HASBE and one by Zhou et al. SeSPHR has lower overhead because the file encryption is symmetric (AES) and only the key undergoes asymmetric operations. This is the hybrid encryption advantage."

---

## Emergency Recovery

**Server crashed:** `cd backend && python run.py` — all data is persisted in SQLite and the cloud folder.

**Frontend blank screen:** `cd frontend && npm run dev` — Vite hot-reload restarts instantly.

**Forgot to seed accounts:** `cd backend && python seed_demo_users.py` — safe to run multiple times, skips existing accounts.

**Need to reset all data:** `cd backend && python reset.py` then re-seed.
