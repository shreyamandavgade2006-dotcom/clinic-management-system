<?php

session_start();

if (!isset($_SESSION["user_id"]) || $_SESSION["role"] != "admin") {
    header("Location: ../auth/login.php");
    exit();
}

include("../config/database.php");

$admin_name = $_SESSION["name"];


$patients_query = mysqli_query(
    $conn,
    "SELECT
        patients.id,
        patients.date_of_birth,
        patients.gender,
        patients.phone,
        patients.address,
        patients.blood_group,
        patients.allergies,

        users.name,
        users.email,
        users.status,
        users.created_at

     FROM patients

     INNER JOIN users
        ON patients.user_id = users.id

     ORDER BY users.created_at DESC"
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

    <title>Patients | ClinicCare Admin</title>

    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css"
    >

    <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
    >

    <link
        rel="stylesheet"
        href="../css/style.css"
    >

    <link
        rel="stylesheet"
        href="../css/admin.css"
    >

</head>

<body>

<div class="admin-layout">


    <aside class="admin-sidebar">

        <div class="admin-brand">

            <div class="admin-brand-icon">
                <i class="fa-solid fa-plus"></i>
            </div>

            <div>
                <h4>ClinicCare</h4>
                <span>Admin Portal</span>
            </div>

        </div>


        <div class="admin-profile">

            <div class="admin-avatar">
                <?php echo strtoupper(substr($admin_name, 0, 1)); ?>
            </div>

            <div class="admin-profile-info">

                <strong>
                    <?php echo htmlspecialchars($admin_name); ?>
                </strong>

                <span>Administrator</span>

            </div>

        </div>


        <nav class="admin-nav">

            <div class="admin-nav-heading">
                MAIN MENU
            </div>

            <a href="dashboard.php" class="admin-nav-link">
                <i class="fa-solid fa-chart-line"></i>
                <span>Dashboard</span>
            </a>

            <a href="doctors.php" class="admin-nav-link">
                <i class="fa-solid fa-user-doctor"></i>
                <span>Doctors</span>
            </a>

            <a href="patients.php" class="admin-nav-link active">
                <i class="fa-solid fa-users"></i>
                <span>Patients</span>
            </a>

            <a href="departments.php" class="admin-nav-link">
                <i class="fa-solid fa-building"></i>
                <span>Departments</span>
            </a>

            <a href="appointments.php" class="admin-nav-link">
                <i class="fa-solid fa-calendar-check"></i>
                <span>Appointments</span>
            </a>

        </nav>


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


    <main class="admin-main">

        <header class="admin-topbar">

            <div class="admin-topbar-left">

                <div class="admin-breadcrumb">
                    Admin Portal / Patients
                </div>

                <h1>Patients</h1>

                <p>
                    View registered patient information.
                </p>

            </div>


            <div class="admin-topbar-right">

                <div class="admin-date-box">

                    <div class="admin-date-icon">
                        <i class="fa-regular fa-calendar"></i>
                    </div>

                    <div>

                        <span>Today</span>

                        <strong>
                            <?php echo date("d M Y"); ?>
                        </strong>

                    </div>

                </div>

            </div>

        </header>


        <div class="admin-content">


            <section class="admin-card">

                <div class="admin-card-header">

                    <div>

                        <h2>Patient List</h2>

                        <p>
                            All registered patients.
                        </p>

                    </div>

                </div>


                <div class="admin-toolbar">

                    <div class="admin-search">

                        <i class="fa-solid fa-magnifying-glass"></i>

                        <input
                            type="text"
                            id="patientSearch"
                            placeholder="Search patient..."
                        >

                    </div>


                    <span class="cc-badge cc-badge-primary">

                        <?php
                        $patient_count_query = mysqli_query(
                            $conn,
                            "SELECT COUNT(*) AS total FROM patients"
                        );

                        $patient_count =
                            mysqli_fetch_assoc(
                                $patient_count_query
                            )["total"];

                        echo $patient_count;
                        ?>

                        Patients

                    </span>

                </div>


                <div class="admin-table-wrapper">

                    <table
                        class="admin-table"
                        id="patientTable"
                    >

                        <thead>

                            <tr>

                                <th>Patient</th>
                                <th>Gender</th>
                                <th>Date of Birth</th>
                                <th>Phone</th>
                                <th>Blood Group</th>
                                <th>Allergies</th>
                                <th>Status</th>

                            </tr>

                        </thead>


                        <tbody>

                        <?php if (mysqli_num_rows($patients_query) > 0) { ?>

                            <?php while ($patient = mysqli_fetch_assoc($patients_query)) { ?>

                                <tr>

                                    <td>

                                        <div class="admin-person">

                                            <div class="admin-person-avatar">

                                                <?php
                                                echo strtoupper(
                                                    substr(
                                                        $patient["name"],
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
                                                        $patient["name"]
                                                    );
                                                    ?>
                                                </strong>

                                                <span>
                                                    <?php
                                                    echo htmlspecialchars(
                                                        $patient["email"]
                                                    );
                                                    ?>
                                                </span>

                                            </div>

                                        </div>

                                    </td>


                                    <td>

                                        <?php
                                        echo !empty(
                                            $patient["gender"]
                                        )
                                            ? htmlspecialchars(
                                                $patient["gender"]
                                            )
                                            : "-";
                                        ?>

                                    </td>


                                    <td>

                                        <?php

                                        if (
                                            !empty(
                                                $patient["date_of_birth"]
                                            )
                                        ) {

                                            echo date(
                                                "d M Y",
                                                strtotime(
                                                    $patient["date_of_birth"]
                                                )
                                            );

                                        } else {

                                            echo "-";

                                        }

                                        ?>

                                    </td>


                                    <td>

                                        <?php
                                        echo !empty(
                                            $patient["phone"]
                                        )
                                            ? htmlspecialchars(
                                                $patient["phone"]
                                            )
                                            : "-";
                                        ?>

                                    </td>


                                    <td>

                                        <?php
                                        echo !empty(
                                            $patient["blood_group"]
                                        )
                                            ? htmlspecialchars(
                                                $patient["blood_group"]
                                            )
                                            : "-";
                                        ?>

                                    </td>


                                    <td>

                                        <?php

                                        if (
                                            !empty(
                                                $patient["allergies"]
                                            )
                                        ) {

                                            echo htmlspecialchars(
                                                $patient["allergies"]
                                            );

                                        } else {

                                            echo "None";

                                        }

                                        ?>

                                    </td>


                                    <td>

                                        <?php if ($patient["status"] == 1) { ?>

                                            <span class="cc-badge cc-badge-success">
                                                Active
                                            </span>

                                        <?php } else { ?>

                                            <span class="cc-badge cc-badge-danger">
                                                Inactive
                                            </span>

                                        <?php } ?>

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
                                            <i class="fa-solid fa-users"></i>
                                        </div>

                                        <h3>
                                            No patients found
                                        </h3>

                                        <p>
                                            Registered patients will appear here.
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


<script>

document.getElementById("patientSearch")
    .addEventListener("input", function () {

        const search =
            this.value.toLowerCase();

        const rows =
            document.querySelectorAll(
                "#patientTable tbody tr"
            );

        rows.forEach(function (row) {

            const text =
                row.innerText.toLowerCase();

            row.style.display =
                text.includes(search)
                    ? ""
                    : "none";

        });

    });

</script>

</body>
</html>