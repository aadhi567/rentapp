import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LandlordLayout from "../components/LandlordLayout";
import { ArrowLeftIcon, BuildingIcon, LayersIcon } from "../components/Icons";
import "./BuildingDashboard.css";

import { API_URL } from "../api";

function BuildingDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [building, setBuilding] = useState(null);
  const [floors, setFloors] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("access_token");

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  };

  const fetchAuth = async (url) => {
    if (!token) {
      logout();
      return null;
    }

    return fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const loadBuildingData = async () => {
    setLoading(true);
    setError("");

    try {
      const buildingResponse =
        await fetchAuth(
          `${API_URL}/buildings/${id}/`
        );

      if (!buildingResponse) {
        return;
      }

      if (buildingResponse.status === 401) {
        logout();
        return;
      }

      const buildingData =
        await buildingResponse.json();

      if (!buildingResponse.ok) {
        throw new Error(
          buildingData.detail ||
            "Unable to load building."
        );
      }

      setBuilding(buildingData);

      const floorsResponse =
        await fetchAuth(
          `${API_URL}/floors/`
        );

      if (!floorsResponse) {
        return;
      }

      if (floorsResponse.status === 401) {
        logout();
        return;
      }

      const floorsData =
        await floorsResponse.json();

      if (!floorsResponse.ok) {
        throw new Error(
          floorsData.detail ||
            "Unable to load floors."
        );
      }

      const buildingFloors =
        Array.isArray(floorsData)
          ? floorsData
              .filter(
                (floor) =>
                  Number(
                    floor.building
                  ) === Number(id)
              )
              .sort(
                (a, b) =>
                  Number(
                    a.floor_number
                  ) -
                  Number(
                    b.floor_number
                  )
              )
          : [];

      setFloors(buildingFloors);

      const unitsResponse =
        await fetchAuth(
          `${API_URL}/units/`
        );

      if (!unitsResponse) {
        return;
      }

      if (unitsResponse.status === 401) {
        logout();
        return;
      }

      const unitsData =
        await unitsResponse.json();

      if (!unitsResponse.ok) {
        throw new Error(
          unitsData.detail ||
            "Unable to load units."
        );
      }

      const floorIds =
        new Set(
          buildingFloors.map(
            (floor) =>
              Number(floor.id)
          )
        );

      const buildingUnits =
        Array.isArray(unitsData)
          ? unitsData.filter(
              (unit) =>
                floorIds.has(
                  Number(unit.floor)
                )
            )
          : [];

      setUnits(buildingUnits);
    } catch (err) {
      console.error(
        "Building dashboard error:",
        err
      );

      setError(
        err.message ||
          "Unable to load building."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setError(
        "Building ID is missing."
      );

      setLoading(false);
      return;
    }

    loadBuildingData();
  }, [id]);

  const stats = useMemo(() => {
    const totalUnits =
      units.length;

    const occupied =
      units.filter(
        (unit) =>
          unit.status === "occupied"
      ).length;

    const vacant =
      units.filter(
        (unit) =>
          unit.status === "vacant"
      ).length;

    const maintenance =
      units.filter(
        (unit) =>
          unit.status === "maintenance"
      ).length;

    const inactive =
      units.filter(
        (unit) =>
          unit.status === "inactive"
      ).length;

    const expectedIncome =
      units
        .filter(
          (unit) =>
            unit.status !== "inactive"
        )
        .reduce(
          (total, unit) =>
            total +
            Number(
              unit.monthly_rent || 0
            ),
          0
        );

    const occupancy =
      totalUnits > 0
        ? Math.round(
            (occupied /
              totalUnits) *
              100
          )
        : 0;

    const residential =
      units.filter(
        (unit) =>
          unit.unit_type ===
          "residential"
      ).length;

    const commercial =
      units.filter(
        (unit) =>
          unit.unit_type ===
          "commercial"
      ).length;

    return {
      totalUnits,
      occupied,
      vacant,
      maintenance,
      inactive,
      expectedIncome,
      occupancy,
      residential,
      commercial,
    };
  }, [units]);

  const getFloorStats = (
    floorId
  ) => {
    const floorUnits =
      units.filter(
        (unit) =>
          Number(unit.floor) ===
          Number(floorId)
      );

    const occupied =
      floorUnits.filter(
        (unit) =>
          unit.status === "occupied"
      ).length;

    const vacant =
      floorUnits.filter(
        (unit) =>
          unit.status === "vacant"
      ).length;

    const maintenance =
      floorUnits.filter(
        (unit) =>
          unit.status === "maintenance"
      ).length;

    const income =
      floorUnits
        .filter(
          (unit) =>
            unit.status !== "inactive"
        )
        .reduce(
          (total, unit) =>
            total +
            Number(
              unit.monthly_rent || 0
            ),
          0
        );

    const occupancy =
      floorUnits.length > 0
        ? Math.round(
            (occupied /
              floorUnits.length) *
              100
          )
        : 0;

    return {
      units:
        floorUnits.length,
      occupied,
      vacant,
      maintenance,
      income,
      occupancy,
    };
  };

  if (loading) {
    return (
      <div className="building-dashboard-loading">

        <div className="building-spinner"></div>

        <p>
          Loading building...
        </p>

      </div>
    );
  }

  if (!building) {
    return (
      <div className="building-dashboard-error">

        <div className="error-box">

          <div className="error-icon">
            !
          </div>

          <h2>
            Unable to load building
          </h2>

          <p>
            {error ||
              "Building not found."}
          </p>

          <button
            className="building-primary-button"
            onClick={() =>
              navigate(
                "/landlord/buildings"
              )
            }
          >
            ← Back to Buildings
          </button>

        </div>

      </div>
    );
  }

  const locationSubtitle = `${building.address || ""}${building.city ? `, ${building.city}` : ""}${building.state ? `, ${building.state}` : ""}${building.pincode ? ` - ${building.pincode}` : ""}`;

  return (
    <LandlordLayout
      breadcrumb={`Buildings / ${building.name}`}
      title={building.name}
      subtitle={locationSubtitle}
      actions={
        <button
          className="secondary-building-button"
          onClick={() =>
            navigate(
              "/landlord/buildings"
            )
          }
        >
          <ArrowLeftIcon size={16} />
          <span>All Buildings</span>
        </button>
      }
    >


      {/* ERROR */}

      {error && (
        <div className="building-error">

          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>

        </div>
      )}


      {/* MAIN STATS */}

      <section className="building-overview-grid">

        <div className="building-stat-card">

          <span>
            Total Floors
          </span>

          <strong>
            {floors.length}
          </strong>

        </div>

        <div className="building-stat-card">

          <span>
            Total Units
          </span>

          <strong>
            {stats.totalUnits}
          </strong>

        </div>

        <div className="building-stat-card">

          <span>
            Occupied
          </span>

          <strong>
            {stats.occupied}
          </strong>

        </div>

        <div className="building-stat-card">

          <span>
            Vacant
          </span>

          <strong>
            {stats.vacant}
          </strong>

        </div>

        <div className="building-stat-card">

          <span>
            Maintenance
          </span>

          <strong>
            {stats.maintenance}
          </strong>

        </div>

        <div className="building-stat-card income">

          <span>
            Expected Monthly Income
          </span>

          <strong>
            ₹
            {stats.expectedIncome.toLocaleString(
              "en-IN"
            )}
          </strong>

        </div>

      </section>


      {/* SUMMARY */}

      <section className="building-summary-grid">

        <div className="summary-card">

          <div className="summary-top">

            <div>

              <span>
                BUILDING OCCUPANCY
              </span>

              <h2>
                {stats.occupancy}%
              </h2>

            </div>

            <div className="occupancy-circle">
              {stats.occupancy}%
            </div>

          </div>


          <div className="occupancy-bar">

            <div
              style={{
                width: `${stats.occupancy}%`,
              }}
            ></div>

          </div>


          <div className="occupancy-details">

            <div>

              <span className="green-dot"></span>

              Occupied

              <strong>
                {stats.occupied}
              </strong>

            </div>

            <div>

              <span className="blue-dot"></span>

              Vacant

              <strong>
                {stats.vacant}
              </strong>

            </div>

            <div>

              <span className="orange-dot"></span>

              Maintenance

              <strong>
                {stats.maintenance}
              </strong>

            </div>

          </div>

        </div>


        {/* UNIT MIX */}

        <div className="summary-card">

          <div className="summary-top">

            <div>

              <span>
                UNIT MIX
              </span>

              <h2>
                {stats.totalUnits}
              </h2>

              <p>
                Total units
              </p>

            </div>

          </div>


          <div className="unit-mix-grid">

            <div>

              <span>
                Residential
              </span>

              <strong>
                {stats.residential}
              </strong>

            </div>

            <div>

              <span>
                Commercial
              </span>

              <strong>
                {stats.commercial}
              </strong>

            </div>

          </div>

        </div>

      </section>


      {/* FLOORS */}

      <section className="floors-section">

        <div className="section-heading">

          <div>

            <span>
              BUILDING STRUCTURE
            </span>

            <h2>
              Floors
            </h2>

          </div>

          <p>
            Select a floor to manage its
            residential and commercial units.
          </p>

        </div>


        {floors.length === 0 ? (

          <div className="empty-floors">

            <div className="empty-floors-icon">
              🏢
            </div>

            <h3>
              No floors found
            </h3>

            <p>
              This building does not have
              any floors yet.
            </p>

          </div>

        ) : (

          <div className="floor-grid">

            {floors.map((floor) => {

              const floorStats =
                getFloorStats(
                  floor.id
                );

              return (
                <button
                  type="button"
                  className="floor-card"
                  key={floor.id}
                  onClick={() =>
                    navigate(
                      `/landlord/floors/${floor.id}`
                    )
                  }
                >

                  <div className="floor-number">
                    {floor.floor_number}
                  </div>


                  <div className="floor-card-content">

                    <div className="floor-card-header">

                      <div>

                        <span>
                          FLOOR
                        </span>

                        <h3>
                          Floor{" "}
                          {floor.floor_number}
                        </h3>

                      </div>

                      <span className="floor-arrow">
                        →
                      </span>

                    </div>


                    <div className="floor-stats">

                      <div>

                        <span>
                          Units
                        </span>

                        <strong>
                          {floorStats.units}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Occupied
                        </span>

                        <strong>
                          {floorStats.occupied}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Vacant
                        </span>

                        <strong>
                          {floorStats.vacant}
                        </strong>

                      </div>

                    </div>


                    <div className="floor-income">

                      <span>
                        Expected Monthly Income
                      </span>

                      <strong>
                        ₹
                        {floorStats.income.toLocaleString(
                          "en-IN"
                        )}
                      </strong>

                    </div>


                    <div className="floor-progress">

                      <div
                        style={{
                          width: `${floorStats.occupancy}%`,
                        }}
                      ></div>

                    </div>


                    <small>
                      {floorStats.occupancy}%
                      {" "}
                      occupied
                    </small>

                  </div>

                </button>
              );
            })}

          </div>

        )}

      </section>

    </LandlordLayout>
  );
}

export default BuildingDashboard;