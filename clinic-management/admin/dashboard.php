<?php

session_start();

if (!isset($_SESSION["user_id"]) || $_SESSION["role"] != "admin") {
    header("Location: ../auth/login.php");
    exit();
}

include("../config/database.php");

$admin_name = $_SESSION["name"];


// =====================================================
// DASHBOARD COUNTS
// =====================================================

// Total doctors
$doctor_query = mysqli_query(
    $conn,
    "SELECT COUNT(*) AS total
     FROM doctors"
);

$total_doctors = mysqli_fetch_assoc($doctor_query)["total"];


// Total patients
$patient_query = mysqli_query(
    $conn,
    "SELECT COUNT(*) AS total
     FROM patients"
);

$total_patients = mysqli_fetch_assoc($patient_query)["total"];


// Total departments
$department_query = mysqli_query(
    $conn,
    "SELECT COUNT(*) AS total
     FROM departments"
);

$total_departments = mysqli_fetch_assoc($department_query)["total"];


// Total appointments
$appointment_query = mysqli_query(
    $conn,
    "SELECT COUNT(*) AS total
     FROM appointments"
);

$total_appointments = mysqli_fetch_assoc($appointment_query)["total"];


// =====================================================
// TODAY'S APPOINTMENTS
// =====================================================

$today = date("Y-m-d");

$today_query = mysqli_query(
    $conn,
    "SELECT COUNT(*) AS total
     FROM appointments
     WHERE appointment_date = '$today'"
);

$today_appointments = mysqli_fetch_assoc($today_query)["total"];


// =====================================================
// RECENT APPOINTMENTS
// =====================================================

$recent_query = mysqli_query(
    $conn,
    "SELECT
        appointments.id,
        appointments.token_number,
        appointments.appointment_date,
        appointments.appointment_time,
        appointments.status,
        appointments.queue_status,

        patient_users.name AS patient_name,
        doctor_users.name AS doctor_name

     FROM appointments

     INNER JOIN patients
        ON appointments.patient_id = patients.id

     INNER JOIN users AS patient_users
        ON patients.user_id = patient_users.id

     INNER JOIN doctors
        ON appointments.doctor_id = doctors.id

     INNER JOIN users AS doctor_users
        ON doctors.user_id = doctor_users.id

     ORDER BY
        appointments.created_at DESC

     LIMIT 5"
);

?>

<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Admin Dashboard | ClinicCare</title>


    <!-- Bootstrap -->

    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css"
    >


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


    <!-- Admin CSS -->

    <link
        rel="stylesheet"
        href="../css/admin.css"
    >

</head>


<body>


<div class="admin-layout">


    <!-- =================================================
         SIDEBAR
    ================================================== -->

    <aside class="admin-sidebar">


        <!-- Brand -->

        <div class="admin-brand">

            <div class="admin-brand-icon">

                <i class="fa-solid fa-plus"></i>

            </div>


            <div>

                <h4>ClinicCare</h4>

                <span>Admin Portal</span>

            </div>

        </div>


        <!-- Admin Profile -->

        <div class="admin-profile">

            <div class="admin-avatar">

                <?php
                echo strtoupper(
                    substr($admin_name, 0, 1)
                );
                ?>

            </div>


            <div class="admin-profile-info">

                <strong>
                    <?php echo htmlspecialchars($admin_name); ?>
                </strong>

                <span>
                    Administrator
                </span>

            </div>

        </div>


        <!-- Navigation -->

        <nav class="admin-nav">


            <div class="admin-nav-heading">
                MAIN MENU
            </div>


            <a
                href="dashboard.php"
                class="admin-nav-link active"
            >

                <i class="fa-solid fa-chart-line"></i>

                <span>Dashboard</span>

            </a>


            <a
                href="doctors.php"
                class="admin-nav-link"
            >

                <i class="fa-solid fa-user-doctor"></i>

                <span>Doctors</span>

            </a>


            <a
                href="patients.php"
                class="admin-nav-link"
            >

                <i class="fa-solid fa-users"></i>

                <span>Patients</span>

            </a>


            <a
                href="departments.php"
                class="admin-nav-link"
            >

                <i class="fa-solid fa-building"></i>

                <span>Departments</span>

            </a>


            <a
                href="appointments.php"
                class="admin-nav-link"
            >

                <i class="fa-solid fa-calendar-check"></i>

                <span>Appointments</span>

            </a>


        </nav>


        <!-- Logout -->

        <div class="admin-sidebar-bottom">

            <a
                href="../auth/logout.php"
                class="admin-logout"
            >

                <i class="fa-solid fa-right-from-bracket"></i>

                <span>Logout</span>

            </a>

        </div>

    </aside>


    <!-- =================================================
         MAIN CONTENT
    ================================================== -->

    <main class="admin-main">


        <!-- Header -->

        <header class="admin-topbar">


            <div class="admin-topbar-left">

                <div class="admin-breadcrumb">

                    Admin Portal / Dashboard

                </div>


                <h1>
                    Dashboard
                </h1>


                <p>
                    Monitor doctors, patients, departments and appointments.
                </p>

            </div>


            <div class="admin-topbar-right">


                <div class="admin-date-box">

                    <div class="admin-date-icon">

                        <i class="fa-regular fa-calendar"></i>

                    </div>


                    <div>

                        <span>
                            Today
                        </span>

                        <strong>
                            <?php echo date("d M Y"); ?>
                        </strong>

                    </div>

                </div>

            </div>

        </header>


        <!-- =================================================
             CONTENT
        ================================================== -->

        <div class="admin-content">


            <!-- Section title -->

            <div class="admin-page-title">

                <h2>
                    Overview
                </h2>

                <p>
                    A quick summary of the clinic management system.
                </p>

            </div>


            <!-- =================================================
                 STAT CARDS
            ================================================== -->

            <div class="admin-stats">


                <!-- Doctors -->

                <div class="admin-stat-card">

                    <div class="admin-stat-icon blue">

                        <i class="fa-solid fa-user-doctor"></i>

                    </div>


                    <div class="admin-stat-info">

                        <span>
                            Total Doctors
                        </span>

                        <strong>
                            <?php echo $total_doctors; ?>
                        </strong>

                    </div>

                </div>


                <!-- Patients -->

                <div class="admin-stat-card">

                    <div class="admin-stat-icon green">

                        <i class="fa-solid fa-users"></i>

                    </div>


                    <div class="admin-stat-info">

                        <span>
                            Total Patients
                        </span>

                        <strong>
                            <?php echo $total_patients; ?>
                        </strong>

                    </div>

                </div>


                <!-- Departments -->

                <div class="admin-stat-card">

                    <div class="admin-stat-icon purple">

                        <i class="fa-solid fa-building"></i>

                    </div>


                    <div class="admin-stat-info">

                        <span>
                            Departments
                        </span>

                        <strong>
                            <?php echo $total_departments; ?>
                        </strong>

                    </div>

                </div>


                <!-- Appointments -->

                <div class="admin-stat-card">

                    <div class="admin-stat-icon orange">

                        <i class="fa-solid fa-calendar-check"></i>

                    </div>


                    <div class="admin-stat-info">

                        <span>
                            Total Appointments
                        </span>

                        <strong>
                            <?php echo $total_appointments; ?>
                        </strong>

                    </div>

                </div>


            </div>


            <!-- =================================================
                 SECOND ROW
            ================================================== -->

            <div class="admin-dashboard-grid">


                <!-- Today's Appointments -->

                <section class="admin-card">


                    <div class="admin-card-header">

                        <div>

                            <h2>
                                Today's Activity
                            </h2>

                            <p>
                                Appointment activity for today.
                            </p>

                        </div>


                        <span class="cc-badge cc-badge-primary">

                            <?php echo $today_appointments; ?>

                            Appointments

                        </span>

                    </div>


                    <div class="admin-card-body">


                        <div
                            style="
                                display:flex;
                                align-items:center;
                                justify-content:space-between;
                                gap:20px;
                            "
                        >


                            <div>

                                <div
                                    style="
                                        font-size:34px;
                                        font-weight:700;
                                        color:var(--cc-navy);
                                    "
                                >

                                    <?php echo $today_appointments; ?>

                                </div>


                                <div
                                    style="
                                        margin-top:4px;
                                        color:var(--cc-muted);
                                        font-size:11px;
                                    "
                                >

                                    appointments scheduled today

                                </div>

                            </div>


                            <div
                                style="
                                    width:58px;
                                    height:58px;
                                    border-radius:12px;
                                    background:var(--cc-blue-light);
                                    color:var(--cc-blue-dark);
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    font-size:22px;
                                "
                            >

                                <i class="fa-solid fa-calendar-day"></i>

                            </div>

                        </div>


                        <div
                            style="
                                margin-top:22px;
                                display:flex;
                                gap:10px;
                                flex-wrap:wrap;
                            "
                        >

                            <a
                                href="appointments.php"
                                class="cc-btn cc-btn-primary"
                            >

                                <i class="fa-solid fa-calendar-check"></i>

                                View Appointments

                            </a>

                        </div>


                    </div>

                </section>


                <!-- Quick Actions -->

                <section class="admin-card">


                    <div class="admin-card-header">

                        <div>

                            <h2>
                                Quick Actions
                            </h2>

                            <p>
                                Frequently used admin options.
                            </p>

                        </div>

                    </div>


                    <div class="admin-quick-actions">


                        <a
                            href="doctors.php"
                            class="admin-quick-action"
                        >

                            <div class="admin-quick-icon blue">

                                <i class="fa-solid fa-user-doctor"></i>

                            </div>


                            <div class="admin-quick-info">

                                <strong>
                                    Manage Doctors
                                </strong>

                                <span>
                                    View and manage doctor records
                                </span>

                            </div>


                            <i class="fa-solid fa-chevron-right admin-quick-arrow"></i>

                        </a>


                        <a
                            href="patients.php"
                            class="admin-quick-action"
                        >

                            <div class="admin-quick-icon green">

                                <i class="fa-solid fa-users"></i>

                            </div>


                            <div class="admin-quick-info">

                                <strong>
                                    Manage Patients
                                </strong>

                                <span>
                                    View registered patients
                                </span>

                            </div>


                            <i class="fa-solid fa-chevron-right admin-quick-arrow"></i>

                        </a>


                        <a
                            href="departments.php"
                            class="admin-quick-action"
                        >

                            <div class="admin-quick-icon purple">

                                <i class="fa-solid fa-building"></i>

                            </div>


                            <div class="admin-quick-info">

                                <strong>
                                    Departments
                                </strong>

                                <span>
                                    Manage clinic departments
                                </span>

                            </div>


                            <i class="fa-solid fa-chevron-right admin-quick-arrow"></i>

                        </a>


                        <a
                            href="appointments.php"
                            class="admin-quick-action"
                        >

                            <div class="admin-quick-icon orange">

                                <i class="fa-solid fa-calendar-check"></i>

                            </div>


                            <div class="admin-quick-info">

                                <strong>
                                    Appointments
                                </strong>

                                <span>
                                    Monitor all appointments
                                </span>

                            </div>


                            <i class="fa-solid fa-chevron-right admin-quick-arrow"></i>

                        </a>


                    </div>

                </section>


            </div>


            <!-- =================================================
                 RECENT APPOINTMENTS
            ================================================== -->

            <section class="admin-card">


                <div class="admin-card-header">


                    <div>

                        <h2>
                            Recent Appointments
                        </h2>

                        <p>
                            Latest appointment activity in the system.
                        </p>

                    </div>


                    <a
                        href="appointments.php"
                        class="cc-btn cc-btn-outline"
                    >

                        View All

                        <i class="fa-solid fa-arrow-right"></i>

                    </a>

                </div>


                <div class="admin-table-wrapper">


                    <table class="admin-table">


                        <thead>

                            <tr>

                                <th>
                                    Token
                                </th>

                                <th>
                                    Patient
                                </th>

                                <th>
                                    Doctor
                                </th>

                                <th>
                                    Date
                                </th>

                                <th>
                                    Time
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>


                        <?php if (
                            mysqli_num_rows($recent_query) > 0
                        ) { ?>


                            <?php while (
                                $appointment = mysqli_fetch_assoc(
                                    $recent_query
                                )
                            ) { ?>


                                <tr>


                                    <!-- Token -->

                                    <td>

                                        <span class="admin-token">

                                            #

                                            <?php
                                            echo $appointment["token_number"];
                                            ?>

                                        </span>

                                    </td>


                                    <!-- Patient -->

                                    <td>

                                        <div class="admin-person">


                                            <div class="admin-person-avatar">

                                                <?php
                                                echo strtoupper(
                                                    substr(
                                                        $appointment["patient_name"],
                                                        0,
                                                        1
                                                    )
                                                );
                                                ?>

                                            </div>


                                            <div class="admin-person-info">

                                                <strong>

                                                    <?php
                                                    echo htmlspecialchars(
                                                        $appointment["patient_name"]
                                                    );
                                                    ?>

                                                </strong>

                                                <span>
                                                    Patient
                                                </span>

                                            </div>

                                        </div>

                                    </td>


                                    <!-- Doctor -->

                                    <td>

                                        <div class="admin-person">


                                            <div
                                                class="admin-person-avatar"
                                                style="
                                                    background:#E0F2FE;
                                                    color:#0369A1;
                                                "
                                            >

                                                <?php
                                                echo strtoupper(
                                                    substr(
                                                        $appointment["doctor_name"],
                                                        0,
                                                        1
                                                    )
                                                );
                                                ?>

                                            </div>


                                            <div class="admin-person-info">

                                                <strong>

                                                    Dr.
                                                    <?php
                                                    echo htmlspecialchars(
                                                        $appointment["doctor_name"]
                                                    );
                                                    ?>

                                                </strong>

                                                <span>
                                                    Doctor
                                                </span>

                                            </div>

                                        </div>

                                    </td>


                                    <!-- Date -->

                                    <td>

                                        <?php
                                        echo date(
                                            "d M Y",
                                            strtotime(
                                                $appointment["appointment_date"]
                                            )
                                        );
                                        ?>

                                    </td>


                                    <!-- Time -->

                                    <td>

                                        <?php
                                        echo date(
                                            "h:i A",
                                            strtotime(
                                                $appointment["appointment_time"]
                                            )
                                        );
                                        ?>

                                    </td>


                                    <!-- Status -->

                                    <td>

                                        <?php

                                        if (
                                            $appointment["status"]
                                            == "pending"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-warning
                                                ">
                                                    Pending
                                                </span>
                                            ';

                                        } elseif (
                                            $appointment["status"]
                                            == "confirmed"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-primary
                                                ">
                                                    Confirmed
                                                </span>
                                            ';

                                        } elseif (
                                            $appointment["status"]
                                            == "completed"
                                        ) {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-success
                                                ">
                                                    Completed
                                                </span>
                                            ';

                                        } else {

                                            echo '
                                                <span class="
                                                    cc-badge
                                                    cc-badge-danger
                                                ">
                                                    Cancelled
                                                </span>
                                            ';

                                        }

                                        ?>

                                    </td>


                                    <!-- Action -->

                                    <td>

                                        <a
                                            href="appointments.php"
                                            class="admin-action-btn view"
                                        >

                                            View

                                            <i class="fa-solid fa-arrow-right"></i>

                                        </a>

                                    </td>


                                </tr>


                            <?php } ?>


                        <?php } else { ?>


                            <tr>

                                <td
                                    colspan="7"
                                    style="padding:0;"
                                >

                                    <div class="admin-empty">

                                        <div class="admin-empty-icon">

                                            <i class="fa-regular fa-calendar-xmark"></i>

                                        </div>

                                        <h3>
                                            No appointments yet
                                        </h3>

                                        <p>
                                            Appointment activity will appear here.
                                        </p>

                                    </div>

                                </td>

                            </tr>


                        <?php } ?>


                        </tbody>

                    </table>


                </div>

            </section>


        </div>

    </main>

</div>

</body>

</html>