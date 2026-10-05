<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'patient') {
    header('Location: ../auth/login.php');
    exit();
}
include('../config/database.php');
$user_id = (int) $_SESSION['user_id'];
$patient_name = $_SESSION['name'];
$pq = mysqli_query($conn, "SELECT id FROM patients WHERE user_id=$user_id LIMIT 1");
$patient = mysqli_fetch_assoc($pq);
if (!$patient)
    die('Patient profile not found.');
$patient_id = (int) $patient['id'];
$today = date('Y-m-d');
$uq = mysqli_query($conn, "SELECT COUNT(*) total FROM notifications WHERE user_id=$user_id AND is_read=0");
$unread = (int) mysqli_fetch_assoc($uq)['total'];
$aq = mysqli_query($conn, "SELECT a.id,a.token_number,a.appointment_date,a.appointment_time,a.status,a.queue_status,u.name doctor_name,d.name department_name FROM appointments a JOIN doctors dr ON a.doctor_id=dr.id JOIN users u ON dr.user_id=u.id JOIN departments d ON dr.department_id=d.id WHERE a.patient_id=$patient_id ORDER BY a.appointment_date DESC,a.appointment_time DESC LIMIT 5");
$nextq = mysqli_query($conn, "SELECT a.id,a.token_number,a.appointment_date,a.appointment_time,a.status,u.name doctor_name,d.name department_name FROM appointments a JOIN doctors dr ON a.doctor_id=dr.id JOIN users u ON dr.user_id=u.id JOIN departments d ON dr.department_id=d.id WHERE a.patient_id=$patient_id AND a.appointment_date>='$today' AND a.status IN('pending','confirmed') ORDER BY a.appointment_date,a.appointment_time LIMIT 1");
$next = mysqli_fetch_assoc($nextq);
$countq = mysqli_query($conn, "SELECT COUNT(*) total FROM appointments WHERE patient_id=$patient_id");
$total = (int) mysqli_fetch_assoc($countq)['total'];
?><!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Patient Dashboard | ClinicCare</title>
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
                <div class="patient-avatar-small"><?php echo strtoupper(substr($patient_name, 0, 1)); ?></div>
                <div class="patient-profile-info">
                    <strong><?php echo htmlspecialchars($patient_name); ?></strong><span>Patient</span></div>
            </div>
            <nav class="patient-nav">
                <div class="patient-nav-heading">MAIN MENU</div><a href="dashboard.php"
                    class="patient-nav-link active"><i
                        class="fa-solid fa-chart-line patient-nav-icon"></i><span>Dashboard</span></a><a
                    href="book_appointment.php" class="patient-nav-link"><i
                        class="fa-solid fa-calendar-plus patient-nav-icon"></i><span>Book Appointment</span></a><a
                    href="appointments.php" class="patient-nav-link"><i
                        class="fa-solid fa-calendar-check patient-nav-icon"></i><span>Appointments</span></a><a
                    href="queue.php" class="patient-nav-link"><i
                        class="fa-solid fa-users patient-nav-icon"></i><span>Live Queue</span></a><a
                    href="prescriptions.php" class="patient-nav-link"><i
                        class="fa-solid fa-prescription-bottle-medical patient-nav-icon"></i><span>Prescriptions</span></a><a
                    href="notifications.php" class="patient-nav-link"><i
                        class="fa-solid fa-bell patient-nav-icon"></i><span>Notifications</span><?php if ($unread) { ?><span
                            class="notification-badge"><?php echo $unread; ?></span><?php } ?></a>
            </nav>
            <div class="patient-sidebar-bottom"><a href="../auth/logout.php" class="patient-logout"><i
                        class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a></div>
        </aside>
        <main class="patient-main">
            <header class="patient-topbar">
                <div>
                    <div style="color:var(--cc-muted);font-size:10px;margin-bottom:6px">Patient Portal / Dashboard</div>
                    <h1>Welcome, <?php echo htmlspecialchars($patient_name); ?></h1>
                    <p>Manage appointments, queue information and prescriptions.</p>
                </div>
                <div style="color:var(--cc-muted);font-size:11px"><?php echo date('d M Y'); ?></div>
            </header>
            <div class="patient-content">
                <div class="patient-stats">
                    <div class="patient-stat">
                        <div class="patient-stat-icon" style="background:var(--cc-blue-light);color:#0369A1"><i
                                class="fa-solid fa-calendar-check"></i></div>
                        <div class="patient-stat-info"><span>Total
                                Appointments</span><strong><?php echo $total; ?></strong></div>
                    </div>
                    <div class="patient-stat">
                        <div class="patient-stat-icon" style="background:var(--cc-success-bg);color:#15803D"><i
                                class="fa-solid fa-bell"></i></div>
                        <div class="patient-stat-info"><span>Unread
                                Notifications</span><strong><?php echo $unread; ?></strong></div>
                    </div>
                    <div class="patient-stat">
                        <div class="patient-stat-icon" style="background:var(--cc-purple-bg);color:#6D28D9"><i
                                class="fa-solid fa-clock"></i></div>
                        <div class="patient-stat-info"><span>Next
                                Appointment</span><strong><?php echo $next ? date('d M', strtotime($next['appointment_date'])) : '-'; ?></strong>
                        </div>
                    </div>
                </div>
                <div class="doctor-grid">
                    <section class="patient-card">
                        <div class="patient-card-header">
                            <div>
                                <h2>Next Appointment</h2>
                                <p>Your nearest scheduled visit.</p>
                            </div>
                        </div>
                        <div class="patient-card-body"><?php if ($next) { ?>
                                <h3 style="margin:0;color:var(--cc-navy);font-size:18px">Dr.
                                    <?php echo htmlspecialchars($next['doctor_name']); ?></h3>
                                <p style="margin:4px 0;color:var(--cc-muted);font-size:11px">
                                    <?php echo htmlspecialchars($next['department_name']); ?></p>
                                <p><strong><?php echo date('d M Y', strtotime($next['appointment_date'])); ?></strong> at
                                    <strong><?php echo date('h:i A', strtotime($next['appointment_time'])); ?></strong></p>
                                <span class="cc-badge cc-badge-primary">Token #<?php echo $next['token_number']; ?></span>
                                <div style="margin-top:18px"><a href="queue.php" class="patient-primary-btn">View Queue</a>
                                </div><?php } else { ?>
                                <div class="cc-empty">
                                    <div class="cc-empty-icon"><i class="fa-regular fa-calendar"></i></div>
                                    <h3>No upcoming appointment</h3>
                                    <p>Book your next clinic appointment.</p><a href="book_appointment.php"
                                        class="patient-primary-btn">Book Appointment</a>
                                </div><?php } ?>
                        </div>
                    </section>
                    <section class="patient-card">
                        <div class="patient-card-header">
                            <div>
                                <h2>Quick Actions</h2>
                                <p>Common patient options.</p>
                            </div>
                        </div>
                        <div class="patient-card-body">
                            <div style="display:grid;gap:10px"><a href="book_appointment.php"
                                    class="patient-primary-btn"><i class="fa-solid fa-calendar-plus"></i>Book
                                    Appointment</a><a href="appointments.php" class="patient-secondary-btn"><i
                                        class="fa-solid fa-calendar-check"></i>My Appointments</a><a
                                    href="prescriptions.php" class="patient-secondary-btn"><i
                                        class="fa-solid fa-prescription-bottle-medical"></i>My Prescriptions</a><a
                                    href="notifications.php" class="patient-secondary-btn"><i
                                        class="fa-solid fa-bell"></i>Notifications</a></div>
                        </div>
                    </section>
                </div>
                <section class="patient-card">
                    <div class="patient-card-header">
                        <div>
                            <h2>Recent Appointments</h2>
                            <p>Your latest appointment records.</p>
                        </div><a href="appointments.php" class="patient-secondary-btn">View All</a>
                    </div>
                    <div class="patient-table-wrapper">
                        <table class="patient-table">
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Doctor</th>
                                    <th>Department</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody><?php if (mysqli_num_rows($aq)) {
                                while ($a = mysqli_fetch_assoc($aq)) { ?>
                                        <tr>
                                            <td><span class="cc-badge cc-badge-primary">#<?php echo $a['token_number']; ?></span>
                                            </td>
                                            <td>Dr. <?php echo htmlspecialchars($a['doctor_name']); ?></td>
                                            <td><?php echo htmlspecialchars($a['department_name']); ?></td>
                                            <td><?php echo date('d M Y', strtotime($a['appointment_date'])); ?></td>
                                            <td><?php if ($a['status'] == 'completed') { ?><span
                                                        class="cc-badge cc-badge-success">Completed</span><?php } elseif ($a['status'] == 'cancelled') { ?><span
                                                        class="cc-badge cc-badge-danger">Cancelled</span><?php } else { ?><span
                                                        class="cc-badge cc-badge-primary"><?php echo ucfirst($a['status']); ?></span><?php } ?>
                                            </td>
                                        </tr><?php }
                            } else { ?>
                                    <tr>
                                        <td colspan="5">
                                            <div class="cc-empty">
                                                <h3>No appointments</h3>
                                                <p>Your appointments will appear here.</p>
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