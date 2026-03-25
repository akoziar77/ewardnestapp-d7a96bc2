import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => currentYear - i);

interface SignUpFieldsProps {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  zipCode: string;
  setZipCode: (v: string) => void;
  dobMonth: string;
  setDobMonth: (v: string) => void;
  dobDay: string;
  setDobDay: (v: string) => void;
  dobYear: string;
  setDobYear: (v: string) => void;
}

export default function SignUpFields({
  firstName, setFirstName,
  lastName, setLastName,
  address, setAddress,
  city, setCity,
  state, setState,
  zipCode, setZipCode,
  dobMonth, setDobMonth,
  dobDay, setDobDay,
  dobYear, setDobYear,
}: SignUpFieldsProps) {
  return (
    <>
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className="h-12"
          />
        </div>
      </div>

      {/* Date of Birth */}
      <div className="space-y-2">
        <Label>Date of birth</Label>
        <div className="grid grid-cols-3 gap-2">
          <Select value={dobMonth} onValueChange={setDobMonth}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dobDay} onValueChange={setDobDay}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={String(d).padStart(2, "0")}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dobYear} onValueChange={setDobYear}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          placeholder="Street address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          className="h-12"
        />
      </div>

      {/* City / State / Zip */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            placeholder="ST"
            value={state}
            onChange={(e) => setState(e.target.value)}
            autoComplete="address-level1"
            maxLength={2}
            className="h-12"
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="zipCode">Zip code</Label>
          <Input
            id="zipCode"
            placeholder="00000"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            autoComplete="postal-code"
            className="h-12"
          />
        </div>
      </div>
    </>
  );
}
