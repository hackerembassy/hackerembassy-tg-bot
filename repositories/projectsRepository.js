const BaseRepository = require("./baseRepository");

class ProjectsRepository extends BaseRepository {
  getProjects() {
    let projects = this.db.prepare("SELECT * FROM projects").all();
    return projects;
  }
  getProjectByName(projectName) {
    let project = this.db
      .prepare("SELECT * FROM projects WHERE name = ?")
      .get(projectName);
    return project ?? null;
  }
  getDonations() {
    let donations = this.db.prepare("SELECT * FROM donations").all();
    return donations;
  }
  getDonationsFor(projectId) {
    let donations = this.db
      .prepare("SELECT * FROM donations WHERE project_id = ?")
      .all(projectId);
    return donations;
  }
  getDonationById(donationId) {
    let donation = this.db
      .prepare("SELECT * FROM donations WHERE id = ?")
      .get(donationId);
    return donation ?? null;
  }
  addProject(projectName, target, currency = "AMD") {
    try {
      if (this.getProjectByName(projectName) !== null) return false;
      this.db
        .prepare(
          "INSERT INTO projects (id, name, target_value, target_currency) VALUES (NULL, ?, ?, ?)"
        )
        .run(projectName, target, currency);
      return true;
    } catch (error) {
      return false;
    }
  }
  removeProject(projectName) {
    try {
      if (this.getProjectByName(projectName) === null) return false;
      this.db.prepare("DELETE FROM projects WHERE name = ?").run(projectName);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  closeProject(projectName) {
    return this.changeProjectStatus(projectName, "closed");
  }

  changeProjectStatus(projectName, status) {
    try {
      if (this.getProjectByName(projectName) === null) return false;
      this.db
        .prepare("UPDATE projects SET status = ? WHERE name = ?")
        .run(status, projectName);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  addDonationTo(projectName, username, value, currency = "AMD") {
    try {
      let projectId = this.getProjectByName(projectName)?.id;
      if (projectId === undefined) return false;
      this.db
        .prepare(
          "INSERT INTO donations (project_id, username, value, currency) VALUES (?, ?, ?, ?)"
        )
        .run(projectId, username, value, currency);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  removeDonationById(donationId) {
    try {
      if (this.getDonationById(donationId) === null) return false;
      this.db.prepare("DELETE FROM donations WHERE id = ?").run(donationId);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = new ProjectsRepository();
