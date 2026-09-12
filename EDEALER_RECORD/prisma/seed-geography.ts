/**
 * Seeds the State (`state_data`) + City (`city_data`) lookup tables with Indian states/UTs and their
 * major cities, so the `/states/ddl` and `/cities/ddl/:stateId` dropdown endpoints return data.
 *
 * Idempotent — upserts on the unique keys (`State.stateName`, `City @@unique([stateId, cityName])`),
 * so it can be re-run safely and only adds what is missing. Super-admins can add more via the
 * Locations admin (StatesTab/CitiesTab) afterwards.
 *
 * Run:  npx tsx prisma/seed-geography.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** State/UT → major cities. Curated (not exhaustive); extend via the Locations admin. */
const GEOGRAPHY: Record<string, string[]> = {
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati',
    'Kadapa', 'Anantapur', 'Kakinada', 'Eluru', 'Ongole', 'Chittoor', 'Machilipatnam', 'Srikakulam',
  ],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu'],
  Assam: [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon',
    'Dhubri', 'Sivasagar', 'Goalpara', 'Barpeta', 'North Lakhimpur',
  ],
  Bihar: [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai',
    'Katihar', 'Munger', 'Chhapra', 'Bihar Sharif', 'Saharsa', 'Sasaram', 'Motihari', 'Nawada',
  ],
  Chhattisgarh: [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Raigarh', 'Jagdalpur',
    'Ambikapur', 'Dhamtari', 'Mahasamund',
  ],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem'],
  Gujarat: [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh',
    'Anand', 'Nadiad', 'Morbi', 'Mehsana', 'Bharuch', 'Navsari', 'Vapi', 'Gandhidham', 'Porbandar',
    'Palanpur', 'Valsad', 'Surendranagar', 'Bhuj', 'Godhra', 'Veraval', 'Amreli',
  ],
  Haryana: [
    'Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal',
    'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Kurukshetra', 'Rewari',
  ],
  'Himachal Pradesh': [
    'Shimla', 'Mandi', 'Solan', 'Dharamshala', 'Kullu', 'Bilaspur', 'Hamirpur', 'Una', 'Nahan',
    'Palampur', 'Chamba', 'Kangra',
  ],
  Jharkhand: [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Hazaribagh', 'Giridih',
    'Ramgarh', 'Phusro', 'Medininagar', 'Chaibasa',
  ],
  Karnataka: [
    'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere',
    'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar', 'Hospet', 'Hassan',
    'Udupi', 'Chitradurga', 'Kolar', 'Mandya', 'Chikkamagaluru',
  ],
  Kerala: [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha',
    'Palakkad', 'Malappuram', 'Kottayam', 'Pathanamthitta', 'Kasaragod', 'Idukki', 'Wayanad',
  ],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam',
    'Rewa', 'Katni', 'Singrauli', 'Burhanpur', 'Khandwa', 'Chhindwara', 'Vidisha', 'Shivpuri',
    'Morena', 'Guna', 'Mandsaur',
  ],
  Maharashtra: [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Solapur', 'Amravati',
    'Navi Mumbai', 'Kolhapur', 'Sangli', 'Malegaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar',
    'Chandrapur', 'Parbhani', 'Jalgaon', 'Nanded', 'Satara', 'Ratnagiri', 'Wardha', 'Beed',
  ],
  Manipur: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul'],
  Meghalaya: ['Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Williamnagar', 'Baghmara'],
  Mizoram: ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Saiha'],
  Nagaland: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon'],
  Odisha: [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Baripada',
    'Bhadrak', 'Jharsuguda', 'Jeypore', 'Angul', 'Dhenkanal', 'Balangir',
  ],
  Punjab: [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala',
    'Pathankot', 'Moga', 'Firozpur', 'Khanna', 'Phagwara', 'Barnala', 'Kapurthala', 'Sangrur',
  ],
  Rajasthan: [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Sikar',
    'Pali', 'Sri Ganganagar', 'Bharatpur', 'Sawai Madhopur', 'Hanumangarh', 'Churu', 'Tonk',
    'Barmer', 'Nagaur', 'Jhunjhunu', 'Chittorgarh',
  ],
  Sikkim: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo', 'Singtam'],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur',
    'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Nagercoil', 'Kancheepuram',
    'Karur', 'Cuddalore', 'Hosur', 'Namakkal', 'Sivakasi', 'Kumbakonam',
  ],
  Telangana: [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Mahbubnagar',
    'Nalgonda', 'Adilabad', 'Suryapet', 'Miryalaguda', 'Siddipet',
  ],
  Tripura: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Ambassa'],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly',
    'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Firozabad', 'Jhansi', 'Mathura',
    'Ayodhya', 'Rampur', 'Muzaffarnagar', 'Mirzapur', 'Etawah', 'Sultanpur', 'Sitapur', 'Bulandshahr',
  ],
  Uttarakhand: [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Nainital',
    'Mussoorie', 'Almora', 'Pithoragarh',
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur',
    'Habra', 'Kharagpur', 'Haldia', 'Krishnanagar', 'Medinipur', 'Jalpaiguri', 'Darjeeling',
    'Cooch Behar', 'Raiganj',
  ],
  'Andaman and Nicobar Islands': ['Port Blair', 'Rangat', 'Mayabunder', 'Diglipur', 'Car Nicobar'],
  Chandigarh: ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  Delhi: ['New Delhi', 'Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Dwarka', 'Rohini'],
  'Jammu and Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Sopore', 'Kathua', 'Pulwama',
  ],
  Ladakh: ['Leh', 'Kargil'],
  Lakshadweep: ['Kavaratti', 'Agatti', 'Minicoy', 'Andrott'],
  Puducherry: ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'],
};

async function main(): Promise<void> {
  let stateCount = 0;
  let cityCount = 0;
  for (const [stateName, cities] of Object.entries(GEOGRAPHY)) {
    const state = await prisma.state.upsert({
      where: { stateName },
      update: {},
      create: { stateName },
    });
    stateCount += 1;
    for (const cityName of cities) {
      await prisma.city.upsert({
        where: { stateId_cityName: { stateId: state.stateId, cityName } },
        update: {},
        create: { stateId: state.stateId, cityName },
      });
      cityCount += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Geography seeded: ${stateCount} states/UTs, ${cityCount} cities.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
