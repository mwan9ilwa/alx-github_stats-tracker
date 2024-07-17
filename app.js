const CLIENT_ID = 'Ov23ctLHTmsAkhhzX22P';
const REDIRECT_URI = 'https://alx-githubstatstracker.netlify.app';
const CLIENT_SECRET = 'c4dc5eaf47130da22eaf5d73115767ef3f5b409f';

let accessToken = localStorage.getItem('accessToken');

document.addEventListener('DOMContentLoaded', (event) => {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${CONFIG.CLIENT_ID}&redirect_uri=${CONFIG.REDIRECT_URI}&scope=user,repo`;
        });
    } else {
        console.error('Login button not found');
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        window.location.reload();
    });

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // proxy service to handle the token exchange
        fetch(`https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: CONFIG.CLIENT_ID,
                client_secret: 'CLIENT_SECRET_PLACEHOLDER',
                code: code,
                redirect_uri: CONFIG.REDIRECT_URI
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.access_token) {
                accessToken = data.access_token;
                localStorage.setItem('accessToken', accessToken);
                window.history.replaceState({}, document.title, "/"); 
                loadDashboard();
            } else {
                throw new Error('Failed to obtain access token');
            }
        })
        .catch(error => {
            console.error('An error occurred:', error);
            alert('An error occurred during login. Please try again.');
        });
    }

    if (accessToken) {
        document.getElementById('loginBtn').classList.add('d-none');
        document.getElementById('logoutBtn').classList.remove('d-none');
        loadDashboard();
    } else {
        document.getElementById('dashboard').classList.add('d-none');
    }
});

// Function to load the dashboard after successful login
async function loadDashboard() {
    showLoading(true);
    try {
        console.log("Access Token:", accessToken);
        const userData = await fetchUserData();
        console.log("User Data:", userData);
        if (!userData.login) {
            throw new Error('Failed to fetch user data: ' + JSON.stringify(userData));
        }
        const [reposData, eventsData] = await Promise.all([
            fetchUserRepos(),
            fetchUserEvents(userData.login)
        ]);
        console.log("Repos Data:", reposData);
        console.log("Events Data:", eventsData);
        
        displayProfile(userData);
        displayStats(userData, reposData);
        displayLanguages(reposData);
        displayContributions(eventsData);
        displayTopRepos(reposData);
        displayRecentActivities(eventsData);
        
        document.getElementById('dashboard').classList.remove('d-none');
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Failed to load dashboard. Error: ' + error.message);
        localStorage.removeItem('accessToken');
        window.location.reload();
    } finally {
        showLoading(false);
    }
}

// Function to fetch user data from GitHub API
async function fetchUserData() {
    const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
    }
    return response.json();
}

// Function to toggle the loading indicator
function showLoading(show) {
    document.getElementById('loadingIndicator').classList.toggle('d-none', !show);
}

// Function to fetch user repositories
async function fetchUserRepos() {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: { 'Authorization': `token ${accessToken}` }
    });
    return response.json();
}

// Function to fetch user events
async function fetchUserEvents(username) {
    const response = await fetch(`https://api.github.com/users/${username}/events?per_page=100`, {
        headers: { 'Authorization': `token ${accessToken}` }
    });
    return response.json();
}

// Function to display the user profile information
function displayProfile(userData) {
    document.getElementById('profileInfo').innerHTML = `
        <img src="${userData.avatar_url}" alt="Profile" width="100" class="rounded-circle mb-3">
        <h3>${userData.name || userData.login}</h3>
        <p>${userData.bio || 'No bio available'}</p>
        <p>
            <strong>Followers:</strong> ${userData.followers} | 
            <strong>Following:</strong> ${userData.following} | 
            <strong>Public Repos:</strong> ${userData.public_repos}
        </p>
    `;
}

// Function to display user stats
function displayStats(userData, reposData) {
    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = reposData.reduce((sum, repo) => sum + repo.forks_count, 0);
    
    document.getElementById('statsInfo').innerHTML = `
        <div class="row">
            <div class="col-md-3">
                <h4>Total Stars</h4>
                <p class="display-4">${totalStars}</p>
            </div>
            <div class="col-md-3">
                <h4>Total Forks</h4>
                <p class="display-4">${totalForks}</p>
            </div>
            <div class="col-md-3">
                <h4>Public Repos</h4>
                <p class="display-4">${userData.public_repos}</p>
            </div>
            <div class="col-md-3">
                <h4>Followers</h4>
                <p class="display-4">${userData.followers}</p>
            </div>
        </div>
    `;
}

// Function to display programming languages
function displayLanguages(reposData) {
    const languages = reposData.reduce((acc, repo) => {
        if (repo.language) {
            acc[repo.language] = (acc[repo.language] || 0) + 1;
        }
        return acc;
    }, {});

    const sortedLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    new Chart(document.getElementById('languagesChart'), {
        type: 'doughnut',
        data: {
            labels: sortedLanguages.map(lang => lang[0]),
            datasets: [{
                data: sortedLanguages.map(lang => lang[1]),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
            }]
        },
        options: {
            responsive: true,
            aspectRatio: 2,
            legend: {
                position: 'right',
            },
            title: {
                display: true,
                text: 'Top 5 Languages'
            }
        }
    });
}

// Function to display contributions
function displayContributions(eventsData) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const contributions = eventsData
        .filter(event => new Date(event.created_at) > last30Days)
        .reduce((acc, event) => {
            const date = event.created_at.split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

    const sortedDates = Object.keys(contributions).sort();

    new Chart(document.getElementById('contributionsChart'), {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Contributions',
                data: sortedDates.map(date => contributions[date]),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Contributions (Last 30 Days)'
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }
        }
    });
}

// Function to display top repositories based on stargazers count
function displayTopRepos(reposData) {
    const topRepos = reposData
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 5);

    document.getElementById('reposList').innerHTML = topRepos.map(repo => `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">${repo.name}</h5>
                <p class="card-text">${repo.description || 'No description available'}</p>
                <p>
                    <strong>Stars:</strong> ${repo.stargazers_count} | 
                    <strong>Forks:</strong> ${repo.forks_count} | 
                    <strong>Language:</strong> ${repo.language || 'Not specified'}
                </p>
                <a href="${repo.html_url}" target="_blank" class="btn btn-primary">View on GitHub</a>
            </div>
        </div>
    `).join('');
}

// Function to display recent activities of the user
function displayRecentActivities(eventsData) {
    const recentActivities = eventsData.slice(0, 10);

    document.getElementById('activitiesList').innerHTML = recentActivities.map(activity => `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">${formatEventType(activity.type)}</h5>
                <p class="card-text">Repo: ${activity.repo.name}</p>
                <p>Date: ${new Date(activity.created_at).toLocaleDateString()}</p>
            </div>
        </div>
    `).join('');
}

// Function to format the event type for display
function formatEventType(eventType) {
    return eventType
        .replace('Event', '')
        .split(/(?=[A-Z])/)
        .join(' ');
}
