<?php

session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'doctor') {
    header('Location: ../auth/login.php');
    exit();
}

include('../config/database.php');

$user_id = (int) $_SESSION['user_id'];
$doctor_name = $_SESSION['name'];

$appointment_id = isset($_GET['id'])
    ? (int) $_GET['id']
    : 0;


// Get doctor ID
$dq = mysqli_query(
    $conn,
    "SELECT id
     FROM doctors
     WHERE user_id = $user_id
     LIMIT 1"
);

$doc = mysqli_fetch_assoc($dq);

if (!$doc) {
    die('Doctor profile not found.');
}

$doctor_id = (int) $doc['id'];


// Get appointment + patient basic account information
$q = mysqli_query(
    $conn,
    "SELECT
        a.id,
        a.token_number,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.status,
        a.queue_status,
        u.name AS patient_name,
        u.email
     FROM appointments a

     JOIN patients p
        ON a.patient_id = p.id

     JOIN users u
        ON p.user_id = u.id

     WHERE a.id = $appointment_id
     AND a.doctor_id = $doctor_id

     LIMIT 1"
);

$appointment = mysqli_fetch_assoc($q);

if (!$appointment) {
    die('Appointment not found.');
}

?>

<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>Patient | ClinicCare</title>

    <!-- Font Awesome -->
    <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
    >

    <!-- Common CSS -->
    <link
        rel="stylesheet"
        href="../css/style.css"
    >

    <!-- Doctor CSS -->
    <link
        rel="stylesheet"
        href="../css/doctor.css"
    >

</head>


<body>

<div class="doctor-page">


    <!-- =====================================================
         SIDEBAR
    ====================================================== -->

    <aside class="doctor-sidebar">


        <div class="doctor-brand">

            <div class="doctor-brand-icon">

                <i class="fa-solid fa-plus"></i>

            </div>

            <div>

                <h4>ClinicCare</h4>

                <span>Doctor Portal</span>

            </div>

        </div>


        <!-- Doctor Profile -->

        <div class="sidebar-doctor">

            <div class="doctor-avatar">

                <?php
                echo strtoupper(
                    substr($doctor_name, 0, 1)
                );
                ?>

            </div>


            <div class="doctor-info">

                <strong>

                    Dr.
                    <?php
                    echo htmlspecialchars($doctor_name);
                    ?>

                </strong>

                <span>
                    Doctor
                </span>

            </div>

        </div>


        <!-- Navigation -->

        <nav class="sidebar-nav">


            <div class="nav-heading">
                MAIN MENU
            </div>


            <a
                href="dashboard.php"
                class="nav-item"
            >

                <i class="fa-solid fa-chart-line"></i>

                <span>
                    Dashboard
                </span>

            </a>


            <a
                href="appointments.php"
                class="nav-item active"
            >

                <i class="fa-solid fa-calendar-check"></i>

                <span>
                    Appointments
                </span>

            </a>


            <a
                href="leave.php"
                class="nav-item"
            >

                <i class="fa-solid fa-calendar-xmark"></i>

                <span>
                    Manage Leave
                </span>

            </a>

        </nav>


        <!-- Logout -->

        <div class="sidebar-bottom">

            <a
                href="../auth/logout.php"
                class="logout-link"
            >

                <i class="fa-solid fa-right-from-bracket"></i>

                <span>
                    Logout
                </span>

            </a>

        </div>

    </aside>


    <!-- =====================================================
         MAIN
    ====================================================== -->

    <main class="doctor-main">


        <!-- HEADER -->

        <header class="doctor-topbar">

            <div>

                <div class="doctor-breadcrumb">
                    Doctor Portal / Patient
                </div>

                <h1>
                    Patient Details
                </h1>

                <p>
                    View patient account and appointment information.
                </p>

            </div>

        </header>


        <!-- CONTENT -->

        <div class="doctor-content">


            <!-- BACK BUTTON -->

            <div style="margin-bottom:18px;">

                <a
                    href="appointments.php"
                    class="cc-btn cc-btn-secondary"
                >

                    <i class="fa-solid fa-arrow-left"></i>

                    Back to Appointments

                </a>

            </div>


            <!-- PATIENT DETAILS -->

            <section class="cc-card">


                <!-- Patient Header -->

                <div class="cc-card-header">


                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:12px;
                        "
                    >

                        <div
                            style="
                                width:45px;
                                height:45px;
                                min-width:45px;
                                border-radius:50%;
                                background:var(--cc-navy);
                                color:white;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                font-weight:700;
                            "
                        >

                            <?php
                            echo strtoupper(
                                substr(
                                    $appointment['patient_name'],
                                    0,
                                    1
                                )
                            );
                            ?>

                        </div>


                        <div>

                            <h2>

                                <?php
                                echo htmlspecialchars(
                                    $appointment['patient_name']
                                );
                                ?>

                            </h2>

                            <p>

                                <?php
                                echo htmlspecialchars(
                                    $appointment['email']
                                );
                                ?>

                            </p>

                        </div>

                    </div>


                    <!-- Token -->

                    <span class="cc-badge cc-badge-primary">

                        Token #

                        <?php
                        echo $appointment['token_number'];
                        ?>

                    </span>


                </div>


                <!-- Appointment Information -->

                <div class="cc-card-body">


                    <div class="row">


                        <!-- Appointment Date -->

                        <div class="col-md-4">

                            <div
                                class="patient-information-item"
                                style="
                                    padding:14px;
                                    background:#F8FAFC;
                                    border:1px solid var(--cc-border-light);
                                    border-radius:8px;
                                    margin-bottom:15px;
                                "
                            >

                                <span
                                    style="
                                        display:block;
                                        color:var(--cc-muted);
                                        font-size:9px;
                                        margin-bottom:4px;
                                    "
                                >
                                    Appointment Date
                                </span>

                                <strong
                                    style="
                                        color:var(--cc-navy);
                                        font-size:12px;
                                    "
                                >

                                    <?php
                                    echo date(
                                        'd M Y',
                                        strtotime(
                                            $appointment['appointment_date']
                                        )
                                    );
                                    ?>

                                </strong>

                            </div>

                        </div>


                        <!-- Time -->

                        <div class="col-md-4">

                            <div
                                class="patient-information-item"
                                style="
                                    padding:14px;
                                    background:#F8FAFC;
                                    border:1px solid var(--cc-border-light);
                                    border-radius:8px;
                                    margin-bottom:15px;
                                "
                            >

                                <span
                                    style="
                                        display:block;
                                        color:var(--cc-muted);
                                        font-size:9px;
                                        margin-bottom:4px;
                                    "
                                >
                                    Appointment Time
                                </span>

                                <strong
                                    style="
                                        color:var(--cc-navy);
                                        font-size:12px;
                                    "
                                >

                                    <?php
                                    echo date(
                                        'h:i A',
                                        strtotime(
                                            $appointment['appointment_time']
                                        )
                                    );
                                    ?>

                                </strong>

                            </div>

                        </div>


                        <!-- Queue Status -->

                        <div class="col-md-4">

                            <div
                                class="patient-information-item"
                                style="
                                    padding:14px;
                                    background:#F8FAFC;
                                    border:1px solid var(--cc-border-light);
                                    border-radius:8px;
                                    margin-bottom:15px;
                                "
                            >

                                <span
                                    style="
                                        display:block;
                                        color:var(--cc-muted);
                                        font-size:9px;
                                        margin-bottom:4px;
                                    "
                                >
                                    Queue Status
                                </span>

                                <strong
                                    style="
                                        color:var(--cc-navy);
                                        font-size:12px;
                                    "
                                >

                                    <?php
                                    echo ucfirst(
                                        $appointment['queue_status']
                                    );
                                    ?>

                                </strong>

                            </div>

                        </div>


                    </div>


                    <!-- Reason -->

                    <div
                        style="
                            padding:14px;
                            background:#F8FAFC;
                            border:1px solid var(--cc-border-light);
                            border-radius:8px;
                            margin-top:3px;
                        "
                    >

                        <span
                            style="
                                display:block;
                                color:var(--cc-muted);
                                font-size:9px;
                                margin-bottom:4px;
                            "
                        >
                            Reason for Visit
                        </span>

                        <strong
                            style="
                                color:var(--cc-navy);
                                font-size:12px;
                            "
                        >

                            <?php

                            echo !empty(
                                $appointment['reason']
                            )
                                ? htmlspecialchars(
                                    $appointment['reason']
                                )
                                : 'General consultation';

                            ?>

                        </strong>

                    </div>


                    <!-- Status + Prescription -->

                    <div
                        style="
                            margin-top:20px;
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <div>

                            <?php if (
                                $appointment['status']
                                == 'completed'
                            ) { ?>

                                <span class="cc-badge cc-badge-success">
                                    Completed
                                </span>

                            <?php } elseif (
                                $appointment['status']
                                == 'confirmed'
                            ) { ?>

                                <span class="cc-badge cc-badge-primary">
                                    Confirmed
                                </span>

                            <?php } elseif (
                                $appointment['status']
                                == 'cancelled'
                            ) { ?>

                                <span class="cc-badge cc-badge-danger">
                                    Cancelled
                                </span>

                            <?php } else { ?>

                                <span class="cc-badge cc-badge-warning">
                                    Pending
                                </span>

                            <?php } ?>

                        </div>


                        <a
                            href="prescription.php?id=<?php echo $appointment_id; ?>"
                            class="cc-btn cc-btn-primary"
                        >

                            <i
                                class="fa-solid fa-prescription-bottle-medical"
                            ></i>

                            Create Prescription

                        </a>

                    </div>


                </div>

            </section>


        </div>

    </main>

</div>

</body>

</html>