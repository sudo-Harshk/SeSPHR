# SeSPHR System Architecture

The following diagram illustrates the secure methodology for sharing Personal Health Records (PHRs) in the cloud using Hybrid Encryption, Proxy Re-Encryption (PRE), and Granular Access Control.

```mermaid
sequenceDiagram
    participant Patient as PHR Owner (Patient)
    participant SRS as Setup & Re-Encryption Server (Proxy)
    participant Cloud as Cloud Storage (Untrusted)
    participant Doctor as Data User (Doctor)

    Note over Patient, Doctor: Setup Phase
    SRS->>SRS: Generate Master Key Pair
    SRS->>Patient: Provide SRS Public Key
    SRS->>Doctor: Provide SRS Public Key

    Note over Patient: Data Preparation & Upload
    Patient->>Patient: 1. Generate AES Key (K)
    Patient->>Patient: 2. Encrypt PHR with K (AES-GCM)
    Patient->>Patient: 3. Wrap K with SRS Public Key -> W(K)
    Patient->>Patient: 4. Define Granular Policies (e.g., Role:Doctor)
    Patient->>Cloud: Upload Encrypted PHR + W(K) + Policies

    Note over Doctor: Data Access Request
    Doctor->>Cloud: Request Access to PHR
    Cloud->>Cloud: Verify Identity & Basic ACL
    Cloud->>SRS: Forward W(K) + Doctor's ID

    Note over SRS: Proxy Re-Encryption (PRE)
    SRS->>SRS: 1. Unwrap W(K) using SRS Private Key
    SRS->>SRS: 2. Evaluate Granular Policy against Doctor Attributes
    SRS->>SRS: 3. Wrap K with Doctor's Public Key -> D(K)
    SRS->>Doctor: Provide D(K)

    Note over Doctor: Decryption & Viewing
    Doctor->>Doctor: 1. Unwrap D(K) using Doctor Private Key
    Doctor->>Doctor: 2. Decrypt PHR using K
    Doctor->>Doctor: 3. View Authorized Portions
```

## Key Components

1.  **Hybrid Encryption**: Combines symmetric encryption (AES-GCM) for data efficiency with asymmetric encryption (RSA-OAEP) for secure key transport.
2.  **Proxy Re-Encryption (SRS)**: A semi-trusted entity that transforms the patient's encrypted key into a doctor-specific encrypted key without ever storing the plaintext data.
3.  **Granular Access Control**: Enables the patient to define specific access policies for different sections of the health record (e.g., Lab Results vs. Personal Notes).
4.  **Attribute-Based Policy Evaluation**: Access decisions are made dynamically based on user attributes (Role, Department, etc.) rather than static user IDs.
