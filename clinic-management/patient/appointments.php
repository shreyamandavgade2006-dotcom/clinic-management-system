<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'patient') {
    header('Location: ../auth/login.php');
    exit();
}
include('../config/database.php');
$user_id = (int) $_SESSION['user_id'];
$name = $_SESSION['name'];
$pq = mysqli_query($conn, "SELECT id FROM patients WHERE user_id=$user_id LIMIT 1");
$p = mysqli_fetch_assoc($pq);
$patient_id = (int) $p['id'];
$q = mysqli_query($conn, "SELECT a.*,u.name doctor_name,d.name department_name FROM appointments a JOIN doctors dr ON a.doctor_id=dr.id JOIN users u ON dr.user_id=u.id JOIN departments d ON dr.department_id=d.id WHERE a.patient_id=$patient_id ORDER BY a.appointment_date DESC,a.appointment_time DESC"); ?><!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Appointments | ClinicCare</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/patient.css">
</head>

<body>
    <div class="patient-layout">
        <aside class="patient-sidebar">
            <div class="patient-brand">
                <div class="patient-brand-icon"><i class="fa-solid fa-plus"></i></div>
                <div>
                    <h3>ClinicCare</h3><span>Patient Portal</span>
                </div>
            </div>
            <div class="patient-profile">
                <div class="patient-avatar-small"><?php echo strtoupper(substr($name, 0, 1)); ?></div>
                <div class="patient-profile-info">
                    <strong><?php echo htmlspecialchars($name); ?></strong><span>Patient</span></div>
            </div>
            <nav class="patient-nav">
                <div class="patient-nav-heading">MAIN MENU</div><a href="dashboard.php" class="patient-nav-link"><i
                        class="fa-solid fa-chart-line patient-nav-icon"></i>Dashboard</a><a href="book_appointment.php"
                    class="patient-nav-link"><i class="fa-solid fa-calendar-plus patient-nav-icon"></i>Book
                    Appointment</a><a href="appointments.php" class="patient-nav-link active"><i
                        class="fa-solid fa-calendar-check patient-nav-icon"></i>Appointments</a><a href="queue.php"
                    class="patient-nav-link"><i class="fa-solid fa-users patient-nav-icon"></i>Live Queue</a><a
                    href="prescriptions.php" class="patient-nav-link"><i
                        class="fa-solid fa-prescription-bottle-medical patient-nav-icon"></i>Prescriptions</a><a
                    href="notifications.php" class="patient-nav-link"><i
                        class="fa-solid fa-bell patient-nav-icon"></i>Notifications</a>
            </nav>
            <div class="patient-sidebar-bottom"><a href="../auth/logout.php" class="patient-logout"><i
                        class="fa-solid fa-right-from-bracket"></i>Logout</a></div>
        </aside>
        <main class="patient-main">
            <header class="patient-topbar">
                <div>
                    <h1>My Appointments</h1>
                    <p>View your appointment history and upcoming visits.</p>
                </div>
            </header>
            <div class="patient-content">
                <section class="patient-card">
                    <div class="patient-card-header">
                        <div>
                            <h2>Appointment List</h2>
                            <p>All your appointments.</p>
                        </div><a href="book_appointment.php" class="patient-primary-btn"><i
                                class="fa-solid fa-plus"></i>New Appointment</a>
                    </div>
                    <div class="patient-table-wrapper">
                        <table class="patient-table">
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Doctor</th>
                                    <th>Department</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody><?php if (mysqli_num_rows($q)) {
                                while ($a = mysqli_fetch_assoc($q)) { ?>
                                        <tr>
                                            <td><span class="cc-badge cc-badge-primary">#<?php echo $a['token_number']; ?></span>
                                            </td>
                                            <td>Dr. <?php echo htmlspecialchars($a['doctor_name']); ?></td>
                                            <td><?php echo htmlspecialchars($a['department_name']); ?></td>
                                            <td><?php echo date('d M Y', strtotime($a['appointment_date'])); ?></td>
                                            <td><?php echo date('h:i A', strtotime($a['appointment_time'])); ?></td>
                                            <td><?php echo htmlspecialchars($a['reason'] ?: 'General consultation'); ?></td>
                                            <td><?php if ($a['status'] == 'completed') { ?><span
                                                        class="cc-badge cc-badge-success">Completed</span><?php } elseif ($a['status'] == 'cancelled') { ?><span
                                                        class="cc-badge cc-badge-danger">Cancelled</span>
                                                    <div style="margin-top:5px;font-size:9px;color:#991B1B">
                                                        <?php echo htmlspecialchars($a['cancel_reason'] ?: 'Doctor unavailable'); ?>
                                                    </div><?php } else { ?><span
                                                        class="cc-badge cc-badge-primary"><?php echo ucfirst($a['status']); ?></span><?php } ?>
                                            </td>
                                            <td><?php if ($a['status'] == 'cancelled') { ?><a
                                                        href="rebook.php?id=<?php echo $a['id']; ?>"
                                                        class="patient-primary-btn">Rebook</a><?php } ?></td>
                                        </tr><?php }
                            } else { ?>
                                    <tr>
                                        <td colspan="8">
                                            <div class="cc-empty">
                                                <div class="cc-empty-icon"><i class="fa-regular fa-calendar"></i></div>
                                                <h3>No appointments</h3>
                                                <p>Book your first appointment to see it here.</p>
                                            </div>
                                        </td>
                                    </tr><?php } ?>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    </div>
</body>

</html>